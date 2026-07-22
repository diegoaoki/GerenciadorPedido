package br.com.integracaomulti.pedidos

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

    suspend fun fetchOrders(baseUrl: String, take: Int = 50): List<OrderUi> =
        withContext(Dispatchers.IO) {
            val url = URL("${baseUrl.trimEnd('/')}/api/orders?take=$take")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            try {
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
