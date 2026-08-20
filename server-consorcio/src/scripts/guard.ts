/**
 * Development script safety guard.
 * Prevents accidental execution against production databases or in production environments.
 */
export function guardDevEnvironment(scriptName: string): void {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_SCRIPTS !== 'true') {
        console.error(`❌ [SECURITY] Script '${scriptName}' execution ABORTED.`);
        console.error('Este script não pode ser executado em ambiente de PRODUÇÃO ou sem a variável ALLOW_DEV_SCRIPTS=true.');
        process.exit(1);
    }
}
