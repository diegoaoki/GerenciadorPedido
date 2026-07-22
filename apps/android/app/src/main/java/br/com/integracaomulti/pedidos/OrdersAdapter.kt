package br.com.integracaomulti.pedidos

import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Locale

class OrdersAdapter : RecyclerView.Adapter<OrdersAdapter.Holder>() {

    private val orders = ArrayList<OrderUi>()
    private val brl = Locale("pt", "BR")

    fun submit(items: List<OrderUi>) {
        orders.clear()
        orders.addAll(items)
        notifyDataSetChanged()
    }

    class Holder(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.order_title)
        val subtitle: TextView = view.findViewById(R.id.order_subtitle)
        val items: TextView = view.findViewById(R.id.order_items)
        val status: TextView = view.findViewById(R.id.order_status)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_order, parent, false)
        return Holder(view)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val o = orders[position]
        val total = String.format(brl, "R$ %.2f", o.grandTotal)
        val date = formatDate(o.placedAt)

        holder.title.text = "#${o.externalOrderId} · $total"
        holder.subtitle.text =
            "${o.marketplace.replace('_', ' ')} · ${o.buyerName}$date"
        holder.items.text = o.itemsSummary
        holder.status.text = o.status

        // Toque abre o detalhe (itens, personalizações, mudar status)
        holder.itemView.setOnClickListener {
            val ctx = holder.itemView.context
            val intent = Intent(ctx, OrderDetailActivity::class.java)
            intent.putExtra(OrderDetailActivity.EXTRA_ORDER_ID, o.id)
            ctx.startActivity(intent)
        }
    }

    private fun formatDate(iso: String): String = try {
        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .parse(iso.take(19))
        if (parsed != null)
            " · " + SimpleDateFormat("dd/MM HH:mm", brl).format(parsed)
        else ""
    } catch (_: Exception) {
        ""
    }

    override fun getItemCount(): Int = orders.size
}
