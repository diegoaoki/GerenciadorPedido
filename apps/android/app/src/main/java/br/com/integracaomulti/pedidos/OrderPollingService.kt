package br.com.integracaomulti.pedidos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Serviço em primeiro plano que consulta a API a cada POLL_INTERVAL_MS e
 * dispara uma notificação para cada pedido novo (ID ainda não conhecido).
 */
class OrderPollingService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    companion object {
        const val CHANNEL_MONITOR = "monitor"
        const val CHANNEL_NEW_ORDER = "novos_pedidos"
        const val POLL_INTERVAL_MS = 60_000L
        private const val ONGOING_ID = 1

        @Volatile
        var isRunning = false
            private set

        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, OrderPollingService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, OrderPollingService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(ONGOING_ID, buildOngoingNotification("Monitorando pedidos…"))
        isRunning = true

        scope.launch {
            while (isActive) {
                try {
                    checkForNewOrders()
                } catch (_: Exception) {
                    // Sem rede/API fora: tenta de novo no próximo ciclo.
                }
                delay(POLL_INTERVAL_MS)
            }
        }
        return START_STICKY
    }

    private suspend fun checkForNewOrders() {
        val orders = ApiClient.fetchOrdersAuthed(this)
        val known = Prefs.knownIds(this)

        // Primeira execução: só memoriza, não notifica tudo de uma vez.
        if (known.isEmpty() && orders.isNotEmpty()) {
            Prefs.setKnownIds(this, orders.map { it.id }.toSet())
            return
        }

        val newOrders = orders.filter { it.id !in known }
        if (newOrders.isNotEmpty()) {
            newOrders.forEachIndexed { index, order -> notifyNewOrder(order, index) }
            Prefs.setKnownIds(this, known + newOrders.map { it.id })
        }
    }

    private fun notifyNewOrder(order: OrderUi, offset: Int) {
        val total = String.format(Locale("pt", "BR"), "R$ %.2f", order.grandTotal)
        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_NEW_ORDER)
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentTitle("🛒 Novo pedido — ${order.marketplace.replace('_', ' ')}")
            .setContentText("#${order.externalOrderId} · ${order.buyerName} · $total")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("#${order.externalOrderId} · ${order.buyerName} · $total\n${order.itemsSummary}"),
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()

        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        // ID único por pedido (hash) para não sobrescrever notificações.
        nm.notify(order.id.hashCode() + offset, notification)
    }

    private fun buildOngoingNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_MONITOR)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Pedidos Hub")
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun createChannels() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_MONITOR, "Monitoramento",
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = "Serviço de monitoramento em execução" },
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_NEW_ORDER, "Novos pedidos",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Alertas de pedidos novos" },
        )
    }

    override fun onDestroy() {
        isRunning = false
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
