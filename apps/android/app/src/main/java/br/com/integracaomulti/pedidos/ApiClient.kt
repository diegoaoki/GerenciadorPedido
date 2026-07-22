package br.com.integracaomulti.pedidos

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class OrderUi(
    val id: String,
    val externalOrderId: String,
    val marketplace: String,
    val status: String,
    val buyerName: String,
    val grandTotal: Double,
    val placedAt: String,
    val itemsSummary: String,
)

/**
 * Cliente mínimo da API do hub (sem dependências externas).
 * baseUrl ex.: http://10.167.92.180:3333
 */
object ApiClient {

    /** Faz login e devolve o JWT. */
    suspend fun login(baseUrl: String, email: String, password: String): String =
        withContext(Dispatchers.IO) {
            val url = URL("${baseUrl.trimEnd('/')}/api/auth/login")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            try {
                val payload = JSONObject().put("email", email).put("password", password)
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                if (conn.responseCode == 401) throw RuntimeException("E-mail ou senha inválidos")
                if (conn.responseCode !in 200..299) {
                    throw RuntimeException("Login falhou: HTTP ${conn.responseCode}")
                }
                JSONObject(conn.inputStream.bufferedReader().readText()).getString("token")
            } finally {
                conn.disconnect()
            }
        }

    /**
     * Busca pedidos com o token salvo; em 401 tenta relogar uma vez com as
     * credenciais salvas e repete.
     */
    suspend fun fetchOrdersAuthed(ctx: Context, take: Int = 50): List<OrderUi> {
        val baseUrl = Prefs.baseUrl(ctx)
        var token = Prefs.token(ctx)

        if (token == null) token = relogin(ctx, baseUrl)

        return try {
            fetchOrders(baseUrl, token, take)
        } catch (e: UnauthorizedException) {
            token = relogin(ctx, baseUrl)
            fetchOrders(baseUrl, token, take)
        }
    }

    private suspend fun relogin(ctx: Context, baseUrl: String): String {
        val email = Prefs.email(ctx)
        val password = Prefs.password(ctx)
        if (email.isBlank() || password.isBlank()) {
            throw RuntimeException("Informe e-mail e senha e toque em Salvar")
        }
        val token = login(baseUrl, email, password)
        Prefs.setToken(ctx, token)
        return token
    }

    class UnauthorizedException : RuntimeException("401")

    suspend fun fetchOrders(baseUrl: String, token: String?, take: Int = 50): List<OrderUi> =
        withContext(Dispatchers.IO) {
            val url = URL("${baseUrl.trimEnd('/')}/api/orders?take=$take")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            if (token != null) conn.setRequestProperty("Authorization", "Bearer $token")
            try {
                if (conn.responseCode == 401) throw UnauthorizedException()
                if (conn.responseCode !in 200..299) {
                    throw RuntimeException("API respondeu HTTP ${conn.responseCode}")
                }
                val body = conn.inputStream.bufferedReader().readText()
                parseOrders(body)
            } finally {
                conn.disconnect()
            }
        }

    private fun parseOrders(body: String): List<OrderUi> {
        val root = JSONObject(body)
        val items = root.getJSONArray("items")
        val orders = ArrayList<OrderUi>(items.length())
        for (i in 0 until items.length()) {
            val o = items.getJSONObject(i)
            val orderItems = o.optJSONArray("items")
            val summary = buildString {
                if (orderItems != null) {
                    for (j in 0 until orderItems.length()) {
                        val it = orderItems.getJSONObject(j)
                        if (j > 0) append(" · ")
                        append("${it.optInt("quantity", 1)}× ${it.optString("title")}")
                    }
                }
            }
            orders.add(
                OrderUi(
                    id = o.getString("id"),
                    externalOrderId = o.optString("externalOrderId", "?"),
                    marketplace = o.optString("marketplace", "?"),
                    status = o.optString("status", "?"),
                    buyerName = o.optString("buyerName").ifBlank { "Cliente" },
                    grandTotal = o.optDouble("grandTotal", 0.0),
                    placedAt = o.optString("placedAt", ""),
                    itemsSummary = summary,
                )
            )
        }
        return orders
    }
}
