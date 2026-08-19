import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const cpf = (body?.cpf || '').replace(/\D/g, '')
  const password = body?.password || ''

  if (!cpf || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'CPF e senha são obrigatórios'
    })
  }

  let userName = 'Carlos Alberto Silva (Dev Test)'
  let userEmail = 'carlos.dev@katari.com.br'
  let userRole = 'CLIENT'
  let kycStatus = 'APPROVED'
  let formattedCpf = '111.444.777-35'

  if (cpf === '22233344405' || cpf.startsWith('222')) {
    userName = 'Mariana Oliveira (KYC Pendente)'
    userEmail = 'mariana.dev@katari.com.br'
    kycStatus = 'PENDING'
    formattedCpf = '222.333.444-05'
  } else if (cpf === '52998224725' || cpf.startsWith('529') || cpf.startsWith('000')) {
    userName = 'Admin Master Katari'
    userEmail = 'admin@katari.com.br'
    userRole = 'MASTER'
    formattedCpf = '529.982.247-25'
  }

  // Generate a realistic mock user session for dev
  return {
    token: `jwt_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    signingSecret: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    payloadSecret: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    user: {
      id: `usr_${cpf || '11144477735'}`,
      name: userName,
      email: userEmail,
      role: userRole,
      cpf: formattedCpf,
      birthDate: '1990-05-15',
      phone: '(11) 98765-4321',
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      kycStatus: kycStatus
    }
  }
})
