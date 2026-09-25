# transitionAlert
- **Arquivo:** `server-consorcio/src/application/alerts/alertQueue.ts`
- **O que faz:** Transição de status da fila com trava + audit (ACK/IN_PROGRESS/RESOLVED/DISMISSED).
- **O que ativa ela:** `POST /admin/notifications/:id/progress|resolve|dismiss` (+ refuse de voucher que encerra alertas).
- **Entradas:** `alertId, to, adminId, adminName, {reason?, ip?}`. DISMISSED exige motivo ≥8. Transição inválida → 409.
- **Saídas:** alerta atualizado; RESOLVED/DISMISSED carimbam `read/readAt/readBy/resolvedAt` e assumem dono se vazio.
- **Regras/efeitos:** tx `Serializable` 10s; `auditLog ALERT_RESOLVED|ALERT_DISMISSED|ALERT_TRANSITION` com `from/to/reason/entityKind/entityId/bidId/subscriptionId`.
