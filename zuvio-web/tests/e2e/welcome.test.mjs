// Teste do fluxo da tela inicial /welcome (plano implementation_plan-tela-inicial)
// Roda sem dependências externas: `npm run test:welcome` (node --test)
// Valida os 6 passos de verificação do plano + critérios de mastria.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('plano tela inicial - arquivos base', () => {
  it('welcome.vue existe com guest middleware, alias e SEO', () => {
    const s = read('app/pages/welcome.vue')
    assert.match(s, /middleware:\s*'guest'/)
    assert.match(s, /WelcomeOnboarding/)
    assert.match(s, /Bem-vindo/)
  })

  it('4 slides existem no carrossel', () => {
    const s = read('app/components/onboarding/WelcomeOnboarding.vue')
    for (const n of ['currentSlide === 0', 'currentSlide === 1', 'currentSlide === 2', 'currentSlide === 3']) {
      assert.ok(s.includes(n), `slide ausente: ${n}`)
    }
    assert.match(s, /totalSlides = 4/)
  })

  it('paleta Katari e ativos locais', () => {
    const css = read('app/assets/css/main.css')
    assert.ok(css.includes('#FF6D00'), 'cor primária ausente')
    assert.ok(css.includes('#263238'), 'cor secundária ausente')
    assert.ok(css.includes('#FAFAFA'), 'fundo claro ausente')
    for (const img of [
      'public/img/onboarding/honda_city_sedan.webp',
      'public/img/onboarding/honda_hr_v.webp',
      'public/img/onboarding/honda_cg_titan.jpg',
      'public/img/onboarding/moto_esportiva.png'
    ]) {
      assert.ok(existsSync(path.join(root, img)), `ativo ausente: ${img}`)
    }
  })
})

describe('passo 1 - raiz sem auth abre /welcome', () => {
  it('middleware auth redireciona deslogado para /welcome (não /auth/login)', () => {
    const s = read('app/middleware/auth.ts')
    assert.ok(s.includes("path: '/welcome'"), 'auth.ts deve apontar para /welcome')
    assert.ok(!s.includes("path: '/auth/login'"), 'auth.ts não deve apontar para /auth/login')
    assert.ok(s.includes('redirect'), 'deve preservar ?redirect=')
  })

  it('index (/) é rota protegida, sem render condicional de onboarding', () => {
    const s = read('app/pages/index.vue')
    assert.match(s, /middleware:\s*'auth'/)
    assert.ok(!s.includes('WelcomeOnboarding v-if'), 'index não deve ter v-if de onboarding')
    assert.ok(!s.match(/from '~\/components\/onboarding\/WelcomeOnboarding\.vue'/), 'index não deve importar onboarding')
  })

  it('guest redireciona logado para /', () => {
    const s = read('app/middleware/guest.ts')
    assert.match(s, /navigateTo\('\/'\)/)
  })
})

describe('passo 2 - navegar entre os 4 slides', () => {
  it('dots clicáveis sincronizados + setas sutis + teclado', () => {
    const s = read('app/components/onboarding/WelcomeOnboarding.vue')
    assert.ok(s.includes('goToSlide(index - 1)'), 'dots devem chamar goToSlide')
    assert.ok(s.includes('carousel-nav-btn'), 'setas sutis prev/next')
    assert.ok(s.includes('prevSlide') && s.includes('nextSlide'), 'prev/next ausentes')
    assert.ok(s.includes('ArrowRight') && s.includes('ArrowLeft'), 'navegação por teclado ausente')
  })

  it('swipe via @vueuse/core (touch + mouse), sem handlers manuais', () => {
    const s = read('app/components/onboarding/WelcomeOnboarding.vue')
    assert.ok(s.includes('usePointerSwipe') && s.includes('@vueuse/core'), 'deve usar @vueuse/core')
    for (const legacy of ['onTouchStart', 'onTouchEnd', 'handleSwipeGesture', 'touchStartX', 'isAutoplay']) {
      assert.ok(!s.includes(legacy), `código legado deve sumir: ${legacy}`)
    }
  })
})

describe('passo 3 - fidelidade visual sem placeholders', () => {
  it('sem embeds externos nem emojis placeholder', () => {
    const s = read('app/components/onboarding/WelcomeOnboarding.vue')
    for (const bad of ['unsplash.com', 'dQw4w9WgXcQ', 'youtube-nocookie', 'user-emoji', 'mini-driver-photo"']) {
      assert.ok(!s.includes(bad), `placeholder deve sumir: ${bad}`)
    }
    // Nenhum emoji gráfico nos botões/avatares (✦ ornamental em CSS é permitido)
    for (const bad of ['🏍', '🚗', '😎']) {
      assert.ok(!s.includes(bad), `emoji deve sumir: ${bad}`)
    }
  })

  it('login sem background externo', () => {
    const s = read('app/pages/auth/login.vue')
    assert.ok(!s.includes('unsplash.com'), 'login não deve puxar unsplash')
  })
})

describe('passos 4 e 5 - CTAs Cadastre-se / Já sou cliente', () => {
  it('botões com ids e destinos corretos + redirect passthrough', () => {
    const s = read('app/components/onboarding/WelcomeOnboarding.vue')
    assert.ok(s.includes('btn-onboarding-register'), 'id do botão Cadastre-se')
    assert.ok(s.includes('btn-onboarding-login'), 'id do botão Já sou cliente')
    assert.ok(s.includes("path: '/auth/register'"), 'Cadastre-se -> /auth/register')
    assert.ok(s.includes("path: '/auth/login'"), 'Já sou cliente -> /auth/login')
    assert.ok(s.includes('redirectTarget'), 'deve repassar ?redirect=')
  })

  it('login e register respeitam ?redirect=', () => {
    const login = read('app/pages/auth/login.vue')
    assert.ok(login.includes('route.query.redirect'), 'login deve ler ?redirect=')
    const register = read('app/pages/auth/register.vue')
    assert.ok(register.includes('route.query.redirect'), 'register deve ler ?redirect=')
  })
})

describe('passo 6 - voltar do login/cadastro para /welcome', () => {
  it('ambos têm botão Voltar para /welcome', () => {
    assert.ok(read('app/pages/auth/login.vue').includes('to="/welcome"'), 'login sem voltar')
    assert.ok(read('app/pages/auth/register.vue').includes('to="/welcome"'), 'register sem voltar')
  })

  it('logout retorna ao /welcome', () => {
    assert.ok(read('app/stores/auth.ts').includes("navigateTo('/welcome')"), 'logout deve ir a /welcome')
  })
})
