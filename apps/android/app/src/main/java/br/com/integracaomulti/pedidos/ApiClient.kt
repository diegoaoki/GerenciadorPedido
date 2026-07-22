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

data class OrderItemDetail(
    val title: String,
    val sku: String,
    val quantity: Int,
    val attributes: String,
    val options: List<Pair<String, String>>, // nome → valor da personalização
)

data class OrderDetail(
    val id: String,
    val externalOrderId: String,
    val marketplace: String,
    val status: String,
    val buyerName: String,
    val grandTotal: Double,
    val trackingCode: String?,
    val items: List<OrderItemDetail>,
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

    /** Request autenticado genérico com relogin automático em 401. */
    private suspend fun authedRequest(
        ctx: Context,
        method: String,
        path: String,
        jsonBody: JSONObject? = null,
    ): String {
        suspend fun doCall(token: String): String = withContext(Dispatchers.IO) {
            val url = URL("${Prefs.baseUrl(ctx).trimEnd('/')}$path")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("Authorization", "Bearer $token")
            try {
                if (jsonBody != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                }
                if (conn.responseCode == 401) throw UnauthorizedException()
                if (conn.responseCode !in 200..299) {
                    throw RuntimeException("API respondeu HTTP ${conn.responseCode}")
                }
                conn.inputStream.bufferedReader().readText()
            } finally {
                conn.disconnect()
            }
        }

        var token = Prefs.token(ctx) ?: relogin(ctx, Prefs.baseUrl(ctx))
        return try {
            doCall(token)
        } catch (e: UnauthorizedException) {
            token = relogin(ctx, Prefs.baseUrl(ctx))
            doCall(token)
        }
    }

    suspend fun fetchOrderDetail(ctx: Context, orderId: String): OrderDetail {
        val body = authedRequest(ctx, "GET", "/api/orders/$orderId")
        val o = JSONObject(body)
        val itemsJson = o.optJSONArray("items")
        val items = ArrayList<OrderItemDetail>()
        if (itemsJson != null) {
            for (i in 0 until itemsJson.length()) {
                val it = itemsJson.getJSONObject(i)
                val variant = it.optJSONObject("variant")
                val attrs = variant?.optJSONObject("attributes")
                val attrText = buildString {
                    attrs?.keys()?.forEach { k ->
                        if (isNotEmpty()) append(" · ")
                        append("$k: ${attrs.optString(k)}")
                    }
                }
                val optionsJson = it.optJSONArray("options")
                val options = ArrayList<Pair<String, String>>()
                if (optionsJson != null) {
                    for (j in 0 until optionsJson.length()) {
                        val op = optionsJson.getJSONObject(j)
                        options.add(op.optString("name") to op.optString("value"))
                    }
                }
                items.add(
                    OrderItemDetail(
                        title = it.optString("title"),
                        sku = it.optString("sku"),
                        quantity = it.optInt("quantity", 1),
                        attributes = attrText,
                        options = options,
                    )
                )
            }
        }
        return OrderDetail(
            id = o.getString("id"),
            externalOrderId = o.optString("externalOrderId", "?"),
            marketplace = o.optString("marketplace", "?"),
            status = o.optString("status", "?"),
            buyerName = o.optString("buyerName").ifBlank { "Cliente" },
            grandTotal = o.optDouble("grandTotal", 0.0),
            trackingCode = o.optString("trackingCode").ifBlank { null },
            items = items,
        )
    }

    /** Atualiza o status; retorna aviso do marketplace se houver. */
    suspend fun updateStatus(
        ctx: Context,
        orderId: String,
        status: String,
        trackingCode: String?,
    ): String? {
        val payload = JSONObject().put("status", status)
        if (!trackingCode.isNullOrBlank()) payload.put("trackingCode", trackingCode)
        // HttpURLConnection não suporta PATCH — a API aceita POST na mesma rota.
        val body = authedRequest(ctx, "POST", "/api/orders/$orderId/status", payload)
        val sync = JSONObject(body).optJSONObject("marketplaceSync")
        return if (sync != null && !sync.optBoolean("ok", true)) {
            sync.optString("error", "falha ao avisar o marketplace")
        } else null
    }

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
