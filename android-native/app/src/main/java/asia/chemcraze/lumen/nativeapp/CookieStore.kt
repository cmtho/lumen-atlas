package asia.chemcraze.lumen.nativeapp

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class CookieStore(context: Context) : CookieJar {
    private val prefs = context.getSharedPreferences("lumen_cookies", Context.MODE_PRIVATE)
    private val values = linkedMapOf<String, String>()

    init {
        prefs.getStringSet("cookies", emptySet())?.forEach { line ->
            val idx = line.indexOf('\t')
            if (idx > 0) values[line.substring(0, idx)] = line.substring(idx + 1)
        }
    }

    private fun persist() {
        prefs.edit().putStringSet("cookies", values.map { "${it.key}\t${it.value}" }.toSet()).apply()
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { values[it.name] = it.value }
        persist()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> =
        values.mapNotNull { (name, value) -> Cookie.parse(url, "$name=$value") }

    fun sessionValue(): String? = values["atlas_user"]

    fun hasSession(): Boolean = !sessionValue().isNullOrBlank()

    fun clear() {
        values.clear()
        prefs.edit().remove("cookies").apply()
    }
}
