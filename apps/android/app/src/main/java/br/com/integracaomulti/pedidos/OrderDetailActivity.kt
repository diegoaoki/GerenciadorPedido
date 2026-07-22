package br.com.integracaomulti.pedidos

import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.util.Locale

/** Detalhe do pedido: itens, personalizações e mudança de status. */
class OrderDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ORDER_ID = "order_id"
        // Transições oferecidas por status atual
        private val NEXT_STATUS = mapOf(
            "PENDING" to listOf("PAID", "CANCELLED"),
            "PAID" to listOf("PROCESSING", "CANCELLED"),
            "PROCESSING" to listOf("SHIPPED", "CANCELLED"),
            "SHIPPED" to listOf("DELIVERED"),
        )
        private val STATUS_LABEL = mapOf(
            "PAID" to "Marcar PAGO",
            "PROCESSING" to "Iniciar PRODUÇÃO",
            "SHIPPED" to "Marcar ENVIADO",
            "DELIVERED" to "Marcar ENTREGUE",
            "CANCELLED" to "Cancelar pedido",
        )
    }

    private lateinit var container: LinearLayout
    private lateinit var orderId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_detail)
        container = findViewById(R.id.detail_container)
        orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: run { finish(); return }
        load()
    }

    private fun load() {
        container.removeAllViews()
        addText("Carregando…", 14f, "#64748B")
        lifecycleScope.launch {
            try {
                val order = ApiClient.fetchOrderDetail(this@OrderDetailActivity, orderId)
                render(order)
            } catch (e: Exception) {
                container.removeAllViews()
                addText("Erro: ${e.message}", 14f, "#DC2626")
            }
        }
    }

    private fun render(order: OrderDetail) {
        container.removeAllViews()
        val total = String.format(Locale("pt", "BR"), "R$ %.2f", order.grandTotal)

        addText("#${order.externalOrderId}", 24f, "#0F172A", bold = true)
        addText(
            "${order.marketplace.replace('_', ' ')} · ${order.buyerName} · $total",
            14f, "#64748B",
        )
        addText("Status: ${order.status}", 16f, "#1D4ED8", bold = true, topMargin = 8)
        order.trackingCode?.let { addText("Rastreio: $it", 14f, "#334155") }

        addText("Itens", 16f, "#0F172A", bold = true, topMargin = 20)
        for (item in order.items) {
            addText("${item.quantity}× ${item.title}", 15f, "#0F172A", topMargin = 10)
            addText("SKU ${item.sku}${if (item.attributes.isNotEmpty()) " · ${item.attributes}" else ""}", 12f, "#64748B")
            for ((name, value) in item.options) {
                addText("⚠ $name: $value", 14f, "#B45309", bold = true)
            }
        }

        val nextOptions = NEXT_STATUS[order.status] ?: emptyList()
        if (nextOptions.isNotEmpty()) {
            addText("Ações", 16f, "#0F172A", bold = true, topMargin = 20)
            for (status in nextOptions) {
                val btn = Button(this)
                btn.text = STATUS_LABEL[status] ?: status
                btn.setOnClickListener { confirmChange(status) }
                container.addView(btn)
            }
        }
    }

    private fun confirmChange(status: String) {
        if (status == "SHIPPED") {
            // Pede o código de rastreio
            val input = EditText(this)
            input.hint = "Código de rastreio (opcional)"
            input.inputType = InputType.TYPE_CLASS_TEXT
            AlertDialog.Builder(this)
                .setTitle("Marcar como enviado")
                .setView(input)
                .setPositiveButton("Confirmar") { _, _ ->
                    applyChange(status, input.text.toString().trim().ifBlank { null })
                }
                .setNegativeButton("Cancelar", null)
                .show()
        } else {
            AlertDialog.Builder(this)
                .setTitle(STATUS_LABEL[status] ?: status)
                .setMessage("Confirmar a mudança de status?")
                .setPositiveButton("Confirmar") { _, _ -> applyChange(status, null) }
                .setNegativeButton("Cancelar", null)
                .show()
        }
    }

    private fun applyChange(status: String, trackingCode: String?) {
        lifecycleScope.launch {
            try {
                val warning = ApiClient.updateStatus(
                    this@OrderDetailActivity, orderId, status, trackingCode,
                )
                Toast.makeText(
                    this@OrderDetailActivity,
                    warning?.let { "Status atualizado. Aviso: $it" } ?: "Status atualizado!",
                    Toast.LENGTH_LONG,
                ).show()
                load()
            } catch (e: Exception) {
                Toast.makeText(this@OrderDetailActivity, "Erro: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun addText(
        text: String,
        sizeSp: Float,
        colorHex: String,
        bold: Boolean = false,
        topMargin: Int = 2,
    ) {
        val tv = TextView(this)
        tv.text = text
        tv.textSize = sizeSp
        tv.setTextColor(android.graphics.Color.parseColor(colorHex))
        if (bold) tv.setTypeface(null, Typeface.BOLD)
        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        )
        params.topMargin = (topMargin * resources.displayMetrics.density).toInt()
        tv.layoutParams = params
        container.addView(tv)
    }
}
