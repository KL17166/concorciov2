<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  ScanLine,
  Smartphone,
  ShieldCheck,
  BadgeCheck,
  Copy,
  Check,
  ArrowRight,
  TriangleAlert
} from 'lucide-vue-next'
import {
  reportGateEvent,
  startDevtoolsWatch,
  startResizeSpoofWatch
} from '~/composables/useDeviceGate'

definePageMeta({
  layout: false
})

useHead({
  title: 'Continue no seu celular | Katari Consórcios',
  meta: [
    {
      name: 'description',
      content: 'O consórcio Katari foi feito para o seu celular. Escaneie o QR code e entre no site como celular.'
    }
  ]
})

// ── URL embutida no QR code (public/img/qr-site.png): o próprio site.
// O celular na mesma rede abre como mobile e cai no fluxo normal.
// Se este endereço mudar (novo IP/domínio de produção), regenere o QR com:
//   node -e "const QR=require('qrcode'); QR.toFile('public/img/qr-site.png','<NOVA_URL>',{width:880,margin:2,color:{dark:'#1A1A1A',light:'#FFFFFF'}})"
// a partir de app/ (usa o pacote `qrcode` já presente em node_modules).
const SITE_URL = 'http://192.168.0.107:3001/'

const copied = ref(false)
const resizeSpoof = ref(false)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(SITE_URL)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = SITE_URL
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function continueOnDesktop() {
  reportGateEvent('gate.bypass')
  useCookie('kat_desktop_ok', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }).value = '1'
  navigateTo('/welcome')
}

let stopDevtools: (() => void) | null = null
let stopResize: (() => void) | null = null

onMounted(() => {
  // Em dev não há telemetria: o porteiro dorme fora de produção.
  if (import.meta.dev) return

  // Telemetria do porteiro: quem caiu aqui, de onde, com o quê.
  reportGateEvent('gate.view')

  // Alarme 1: DevTools aberto nesta tela.
  stopDevtools = startDevtoolsWatch(() => {
    reportGateEvent('gate.devtools')
  })

  // Alarme 2: janela "encolhida" para fingir celular.
  stopResize = startResizeSpoofWatch((vw) => {
    resizeSpoof.value = true
    reportGateEvent('gate.resize-spoof', { vw })
  })
})

onUnmounted(() => {
  stopDevtools?.()
  stopResize?.()
})
</script>

<template>
  <div class="gate-page">
    <!-- Painel esquerdo: marca + história (desktop) / cabeçalho (mobile) -->
    <aside class="gate-hero">
      <div class="hero-inner">
        <div class="gate-brand">
          <div class="brand-icon-circle"><span class="brand-k">K</span></div>
          <div class="brand-texts">
            <span class="brand-name">KATARI</span>
            <span class="brand-sub">Consórcios</span>
          </div>
        </div>

        <h1 class="gate-title">
          O Katari vive<br />
          <span class="title-accent">no seu celular.</span>
        </h1>
        <p class="gate-sub">
          Desenhamos cada detalhe para a palma da sua mão. Leia o QR code com o celular e entre no site com seu celular.
        </p>

        <ol class="steps">
          <li class="step">
            <span class="step-num">1</span>
            <ScanLine :size="20" class="step-icon" />
            <div class="step-texts">
              <strong>Escaneie o QR code</strong>
              <span>Use a câmera do celular, sem app extra.</span>
            </div>
          </li>
          <li class="step">
            <span class="step-num">2</span>
            <Smartphone :size="20" class="step-icon" />
            <div class="step-texts">
              <strong>O site abre no celular</strong>
              <span>Já no modo celular, pronto para entrar.</span>
            </div>
          </li>
          <li class="step">
            <span class="step-num">3</span>
            <BadgeCheck :size="20" class="step-icon" />
            <div class="step-texts">
              <strong>Entre na sua conta</strong>
              <span>Seus consórcios continuam de onde pararam.</span>
            </div>
          </li>
        </ol>

        <div class="trust-row">
          <span class="trust-chip">
            <ShieldCheck :size="14" /> Ambiente seguro
          </span>
          <span class="trust-chip">
            <BadgeCheck :size="14" /> Sem juros abusivos
          </span>
        </div>

        <img
          src="/img/onboarding/r15.png"
          alt="Yamaha YZF-R15 — conquista Katari"
          class="hero-moto"
        />
      </div>
    </aside>

    <!-- Painel direito: QR + ações -->
    <main class="gate-action">
      <div v-if="resizeSpoof" class="spoof-notice" role="alert">
        <TriangleAlert :size="16" />
        <span>Redimensionar a janela não libera o acesso. O Katari abre no celular.</span>
      </div>

      <div class="qr-frame">
        <img src="/img/qr-site.png" alt="QR code para entrar no site Katari pelo celular" class="qr-img" />
      </div>
      <p class="qr-hint">Leia o QR code com o celular para entrar no site</p>

      <button type="button" class="link-copy" @click="copyLink">
        <component :is="copied ? Check : Copy" :size="14" />
        <span class="link-url">{{ SITE_URL }}</span>
        <span class="link-action">{{ copied ? 'Copiado!' : 'Copiar link' }}</span>
      </button>

      <button type="button" class="desktop-bypass" @click="continueOnDesktop">
        Continuar no computador <ArrowRight :size="14" />
      </button>

      <footer class="gate-footer">© Katari Consórcios</footer>
    </main>
  </div>
</template>

<style scoped>
.gate-page {
  min-height: 100vh;
  width: 100%;
  background: #FAFAFA;
  font-family: 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
}

/* ── Painel esquerdo (hero) ── */
.gate-hero {
  background: linear-gradient(160deg, #14181D 0%, #1F262E 60%, #263238 100%);
  color: #FFFFFF;
  padding: 40px 28px 0;
  overflow: hidden;
  position: relative;
}

.hero-inner {
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.gate-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.brand-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF6D00 0%, #E65100 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.35);
}

.brand-k {
  color: #FFFFFF;
  font-size: 20px;
  font-weight: 900;
}

.brand-texts {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.brand-name {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #FFFFFF;
}

.brand-sub {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
}

.gate-title {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.12;
  margin: 0 0 12px;
}

.title-accent {
  color: #FF6D00;
}

.gate-sub {
  font-size: 15px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 28px;
  max-width: 380px;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 14px 16px;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 109, 0, 0.18);
  color: #FF8F00;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-icon {
  color: #FF8F00;
  flex-shrink: 0;
}

.step-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-texts strong {
  font-size: 14px;
  color: #FFFFFF;
}

.step-texts span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

.trust-row {
  margin-top: 20px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.trust-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 7px 12px;
}

.hero-moto {
  width: 100%;
  max-width: 460px;
  margin: 24px auto -30px;
  display: block;
  filter: drop-shadow(0 24px 40px rgba(0, 0, 0, 0.45));
}

/* ── Painel direito (ação) ── */
.gate-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 44px 24px 24px;
  max-width: 520px;
  width: 100%;
  margin: 0 auto;
}

.spoof-notice {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  color: #92400E;
  font-size: 13px;
  font-weight: 600;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 20px;
  text-align: left;
}

.qr-frame {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 12px 32px rgba(38, 50, 56, 0.1);
  border: 1px solid #EEEEEE;
}

.qr-img {
  width: 200px;
  height: 200px;
  display: block;
}

.qr-hint {
  font-size: 13px;
  font-weight: 600;
  color: #9E9E9E;
  margin: 14px 0 0;
}

.link-copy {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #9E9E9E;
  padding: 6px 8px;
  border-radius: 8px;
}

.link-copy:hover {
  background: #F5F5F5;
  color: #616161;
}

.link-url {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}

.link-action {
  font-weight: 700;
  color: #FF6D00;
}

.desktop-bypass {
  margin-top: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #BDBDBD;
  padding: 8px;
}

.desktop-bypass:hover {
  color: #757575;
}

.gate-footer {
  margin-top: auto;
  padding-top: 32px;
  font-size: 12px;
  color: #BDBDBD;
}

/* ── Desktop de verdade: split 55/45 ── */
@media (min-width: 1024px) {
  .gate-page {
    flex-direction: row;
    align-items: stretch;
  }

  .gate-hero {
    flex: 1.2;
    padding: 56px 56px 0;
    display: flex;
  }

  .hero-inner {
    margin: auto;
    width: 100%;
  }

  .gate-title {
    font-size: 52px;
  }

  .gate-sub {
    font-size: 17px;
  }

  .gate-action {
    flex: 1;
    justify-content: center;
    padding: 56px;
    max-width: 560px;
  }

  .qr-img {
    width: 240px;
    height: 240px;
  }
}
</style>
