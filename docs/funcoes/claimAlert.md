# claimAlert
- **Arquivo:** `server-consorcio/src/application/alerts/alertQueue.ts`
- **O que faz:** Atendente/gerente assume alerta da fila (OPEN→ACK com dono).
- **O que ativa ela:** `POST /admin/notifications/:id/claim` (`notificationsController.claim`).
- **Entradas:** `alertId, adminId, adminName, ip?`. Erros: 404 sem alerta; 409 se RESOLVED/DISMISSED ou já assumido por outro.
- **Saídas:** alerta atualizado. Idempotente por dono.
- **Regras/efeitos:** tx `Serializable` 10s; escreve `assignedTo/assignedAt`; `auditLog ALERT_CLAIMED`.
