import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { validateMagicBytes } from '../security/magicBytes';

// Ensure private KYC storage directory exists (OUTSIDE of public web root)
export const KYC_STORAGE_DIR = path.join(process.cwd(), 'storage', 'kyc');
if (!fs.existsSync(KYC_STORAGE_DIR)) {
    fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true });
}

// Allowed file types: images + PDF
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

// Dangerous extensions that should NEVER be accepted
const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
    '.sh', '.bash', '.csh',
    '.php', '.php3', '.php4', '.php5', '.phtml',
    '.asp', '.aspx', '.jsp', '.jspx', '.cgi',
    '.js', '.ts', '.py', '.rb', '.pl',
    '.html', '.htm', '.svg', '.xml',
    '.dll', '.so', '.dylib',
    '.zip', '.tar', '.gz', '.rar', '.7z',
];

const storage = multer.diskStorage({
    destination: (req: any, file, cb) => {
        const userId = req.user?.userId || 'anonymous';
        const userUploadDir = path.join(KYC_STORAGE_DIR, userId);
        
        if (!fs.existsSync(userUploadDir)) {
            fs.mkdirSync(userUploadDir, { recursive: true });
        }
        
        cb(null, userUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const ext = path.extname(sanitizedName).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // 1. Block dangerous extensions explicitly
    if (BLOCKED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Tipo de arquivo bloqueado: ${ext}. Apenas imagens (JPG, PNG, GIF, WebP) e PDF são aceitos.`), false);
    }

    // 2. Check allowed extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Extensão não permitida: ${ext}. Apenas imagens (JPG, PNG, GIF, WebP) e PDF são aceitos.`), false);
    }

    // 3. Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Tipo MIME não permitido: ${file.mimetype}. O arquivo pode estar disfarçado.`), false);
    }

    // 4. Cross-validate extension vs MIME type
    const mimeExtMap: Record<string, string[]> = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/webp': ['.webp'],
        'application/pdf': ['.pdf']
    };

    const validExtsForMime = mimeExtMap[file.mimetype];
    if (validExtsForMime && !validExtsForMime.includes(ext)) {
        return cb(new Error(`A extensão ${ext} não corresponde ao tipo do arquivo (${file.mimetype}). Upload bloqueado por segurança.`), false);
    }

    cb(null, true);
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only 1 file per request
    }
});

/**
 * Express middleware to verify magic bytes of the uploaded file after multer disk write.
 */
export const verifyUploadedMagicBytes = (req: any, res: any, next: any) => {
    if (req.file && req.file.path) {
        const isValid = validateMagicBytes(req.file.path);
        if (!isValid) {
            // Delete corrupt or disguised file
            try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
            return res.status(400).json({
                success: false,
                error: 'INVALID_FILE_CONTENT',
                message: 'O conteúdo do arquivo não corresponde a uma imagem válida ou documento PDF.'
            });
        }
    }
    next();
};
