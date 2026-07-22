package br.com.integracaomulti.pedidos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var adapter: OrdersAdapter
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var statusText: TextView
    private lateinit var monitorButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val urlInput = findViewById<EditText>(R.id.url_input)
        val saveButton = findViewById<Button>(R.id.save_url_button)
        monitorButton = findViewById(R.id.monitor_button)
        statusText = findViewById(R.id.status_text)
        swipe = findViewById(R.id.swipe)

        urlInput.setText(Prefs.baseUrl(this))

        adapter = OrdersAdapter()
        findViewById<RecyclerView>(R.id.orders_list).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }

        saveButton.setOnClickListener {
            Prefs.setBaseUrl(this, urlInput.text.toString())
            Toast.makeText(this, "Servidor salvo", Toast.LENGTH_SHORT).show()
            refresh()
        }

        monitorButton.setOnClickListener {
            if (OrderPollingService.isRunning) {
                OrderPollingService.stop(this)
                updateMonitorButton(false)
            } else {
                OrderPollingService.start(this)
                updateMonitorButton(true)
            }
        }

        swipe.setOnRefreshListener { refresh() }

        requestNotificationPermission()
        updateMonitorButton(OrderPollingService.isRunning)
        refresh()
    }

    private fun refresh() {
        swipe.isRefreshing = true
        lifecycleScope.launch {
            try {
                val orders = ApiClient.fetchOrders(Prefs.baseUrl(this@MainActivity))
                adapter.submit(orders)
                statusText.text =
                    if (orders.isEmpty()) "Nenhum pedido ainda."
                    else "${orders.size} pedido(s)"
            } catch (e: Exception) {
                statusText.text = "Sem conexão com o servidor (${e.message})"
            } finally {
                swipe.isRefreshing = false
            }
        }
    }

    private fun updateMonitorButton(running: Boolean) {
        monitorButton.text =
            if (running) "⏸ Parar monitoramento" else "▶ Monitorar novos pedidos"
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1,
            )
        }
    }
}
