// ══════════════════════════════════════════════════════════
// Mensagem padrão de consentimento LGPD
// Centralizada aqui para garantir consistência em todos os
// pontos de envio: cadastro automático e reenvio manual.
// ══════════════════════════════════════════════════════════

export function MENSAGEM_CONSENTIMENTO(nome: string): string {
  return (
    `Oi ${nome}! 👋\n\n` +
    `O Brechó Bellasu pede sua autorização para enviar mensagens pelo WhatsApp sobre:\n\n` +
    `• 🛍️ Novidades, promoções e ofertas exclusivas\n` +
    `• 🎥 Avisos das nossas lives com peças selecionadas\n\n` +
    `Você pode cancelar quando quiser, é só nos avisar.\n\n` +
    `Responda:\n` +
    `✅ *SIM* — Autorizo\n` +
    `❌ *NÃO* — Não autorizo`
  )
}
