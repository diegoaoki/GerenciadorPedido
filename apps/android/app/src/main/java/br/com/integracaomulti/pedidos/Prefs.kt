package br.com.integracaomulti.pedidos

import android.content.Context

/** Preferências: URL do servidor e IDs de pedidos já conhecidos. */
object Prefs {
    private const val FILE = "pedidos_hub"
    private const val KEY_BASE_URL = "base_url"
    private const val KEY_KNOWN_IDS = "known_order_ids"
    private const val KEY_EMAIL = "auth_email"
    private const val KEY_PASSWORD = "auth_password"
    private const val KEY_TOKEN = "auth_token"
    const val DEFAULT_BASE_URL = "https://integracao-api-six.vercel.app"

    fun baseUrl(ctx: Context): String =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL

    fun setBaseUrl(ctx: Context, url: String) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit().putString(KEY_BASE_URL, url.trim()).apply()
    }

    fun email(ctx: Context): String =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_EMAIL, "") ?: ""

    fun password(ctx: Context): String =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_PASSWORD, "") ?: ""

    fun setCredentials(ctx: Context, email: String, password: String) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
            .putString(KEY_EMAIL, email.trim())
            .putString(KEY_PASSWORD, password)
            .remove(KEY_TOKEN) // força novo login
            .apply()
    }

    fun token(ctx: Context): String? =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

    fun setToken(ctx: Context, token: String?) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
            .apply { if (token == null) remove(KEY_TOKEN) else putString(KEY_TOKEN, token) }
            .apply()
    }

    fun knownIds(ctx: Context): Set<String> =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getStringSet(KEY_KNOWN_IDS, emptySet()) ?: emptySet()

    fun setKnownIds(ctx: Context, ids: Set<String>) {
        // Mantém no máximo 500 IDs para não crescer para sempre.
        val trimmed = if (ids.size > 500) ids.take(500).toSet() else ids
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit().putStringSet(KEY_KNOWN_IDS, trimmed).apply()
    }
}
