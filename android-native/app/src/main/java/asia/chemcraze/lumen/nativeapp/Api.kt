package asia.chemcraze.lumen.nativeapp

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.CookieManager
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

data class Profile(
    val name: String,
    val handle: String,
    val bio: String,
    val home: String,
    val avatarColor: String,
    val avatarUrl: String?,
)

data class Account(val username: String, val role: String)

data class Photo(
    val id: String,
    val title: String,
    val thumb: String,
    val image: String,
    val capturedAt: String,
    val country: String,
    val province: String,
    val city: String,
    val district: String,
    val locationName: String,
    val lat: Double?,
    val lng: Double?,
    val tags: List<String>,
    val personIds: List<String>,
) {
    val place: String
        get() = listOf(country, province, city, district, locationName)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(" · ")
            .ifBlank { "未命名坐标" }
}

data class Person(val id: String, val name: String, val color: String)

data class PlaceResult(
    val label: String,
    val detail: String,
    val country: String,
    val countryCode: String,
    val province: String,
    val city: String,
    val district: String,
    val lat: Double,
    val lng: Double,
    val source: String,
)

data class Bootstrap(
    val profile: Profile,
    val account: Account,
    val photos: List<Photo>,
    val people: List<Person>,
    val siteName: String,
)

class ApiException(message: String) : Exception(message)

object Api {
    const val BASE = "https://lumen.chemcraze.asia"
    lateinit var cookies: CookieStore
        private set
    lateinit var client: OkHttpClient
        private set

    fun init(context: Context) {
        if (this::client.isInitialized) return
        cookies = CookieStore(context.applicationContext)
        client = OkHttpClient.Builder()
            .cookieJar(cookies)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    fun hasSession(): Boolean = this::cookies.isInitialized && cookies.hasSession()

    fun clear() {
        cookies.clear()
        CookieManager.getInstance().removeAllCookies(null)
        CookieManager.getInstance().flush()
    }

    fun syncWebViewCookie() {
        val value = cookies.sessionValue() ?: return
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setCookie(BASE, "atlas_user=$value; Path=/; Secure; SameSite=Lax")
        CookieManager.getInstance().flush()
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching { JSONObject(text).optString("error") }.getOrNull()
                throw ApiException(message?.takeIf { it.isNotBlank() } ?: "请求失败 (${response.code})")
            }
            text
        }
    }

    suspend fun login(username: String, password: String) {
        val body = JSONObject()
            .put("username", username.trim())
            .put("password", password)
            .toString()
            .toRequestBody("application/json".toMediaType())
        execute(Request.Builder().url("$BASE/api/auth/login").post(body).build())
    }

    suspend fun bootstrap(): Bootstrap {
        val text = execute(Request.Builder().url("$BASE/api/bootstrap").get().build())
        val root = JSONObject(text)
        val profile = root.getJSONObject("profile")
        val account = root.getJSONObject("account")
        val people = root.optJSONArray("people") ?: JSONArray()
        val photos = root.optJSONArray("photos") ?: JSONArray()
        val site = root.optJSONObject("site")
        return Bootstrap(
            profile = Profile(
                name = profile.optString("name", "旅人"),
                handle = profile.optString("handle", ""),
                bio = profile.optString("bio", ""),
                home = profile.optString("home", ""),
                avatarColor = profile.optString("avatarColor", "#65f4ff"),
                avatarUrl = profile.optString("avatarUrl").takeIf { it.isNotBlank() }?.absolute(),
            ),
            account = Account(account.optString("username"), account.optString("role", "member")),
            photos = (0 until photos.length()).map { photos.getJSONObject(it).toPhoto() },
            people = (0 until people.length()).map {
                val p = people.getJSONObject(it)
                Person(p.optString("id"), p.optString("name"), p.optString("color", "#65f4ff"))
            },
            siteName = site?.optString("siteName")?.takeIf { it.isNotBlank() } ?: "LUMEN ATLAS",
        )
    }

    private fun JSONObject.toPhoto(): Photo {
        val tags = mutableListOf<String>()
        optJSONArray("tags")?.let { arr -> for (i in 0 until arr.length()) tags += arr.optString(i) }
        val personIds = mutableListOf<String>()
        optJSONArray("personIds")?.let { arr -> for (i in 0 until arr.length()) personIds += arr.optString(i) }
        return Photo(
            id = optString("id"),
            title = optString("title", "未命名影像"),
            thumb = optString("thumb").absolute(),
            image = optString("image").absolute(),
            capturedAt = optString("capturedAt"),
            country = optString("country"),
            province = optString("province"),
            city = optString("city"),
            district = optString("district"),
            locationName = optString("locationName"),
            lat = optDouble("lat").takeIf { !it.isNaN() },
            lng = optDouble("lng").takeIf { !it.isNaN() },
            tags = tags,
            personIds = personIds,
        )
    }

    private fun String.absolute(): String = when {
        isBlank() -> ""
        startsWith("http") -> this
        startsWith("/") -> BASE + this
        else -> "$BASE/$this"
    }

    suspend fun searchPlaces(query: String): List<PlaceResult> {
        if (query.isBlank()) return emptyList()
        val url = "$BASE/api/geocode/search".toHttpUrl().newBuilder()
            .addQueryParameter("q", query.trim())
            .build()
        val text = execute(Request.Builder().url(url).get().build())
        val arr = JSONObject(text).optJSONArray("results") ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val r = arr.optJSONObject(i) ?: return@mapNotNull null
            val lat = r.optDouble("lat", Double.NaN)
            val lng = r.optDouble("lng", Double.NaN)
            if (lat.isNaN() || lng.isNaN()) return@mapNotNull null
            PlaceResult(
                label = r.optString("label", "地点"),
                detail = r.optString("detail", ""),
                country = r.optString("country", ""),
                countryCode = r.optString("countryCode", ""),
                province = r.optString("province", ""),
                city = r.optString("city", ""),
                district = r.optString("district", ""),
                lat = lat,
                lng = lng,
                source = r.optString("source", ""),
            )
        }
    }

    suspend fun upload(context: Context, uris: List<Uri>, titlePrefix: String, place: PlaceResult? = null): Int {
        if (uris.isEmpty()) return 0
        val metadata = JSONArray()
        val parts = mutableListOf<Pair<String, ByteArray>>()
        uris.forEachIndexed { index, uri ->
            val bytes = withContext(Dispatchers.IO) {
                context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw ApiException("无法读取所选图片")
            }
            val resolver = context.contentResolver
            val name = runCatching {
                resolver.query(uri, null, null, null, null)?.use { c ->
                    if (c.moveToFirst()) {
                        val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (idx >= 0) c.getString(idx) else null
                    } else null
                }
            }.getOrNull() ?: "photo-${index + 1}.jpg"
            val mime = resolver.getType(uri) ?: "image/jpeg"
            var date: String? = null
            var lat: Double? = null
            var lng: Double? = null
            runCatching {
                resolver.openInputStream(uri)?.use { input ->
                    val exif = ExifInterface(input)
                    val exifDate = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
                        ?: exif.getAttribute(ExifInterface.TAG_DATETIME)
                    if (!exifDate.isNullOrBlank()) {
                        date = runCatching {
                            val parsed = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).parse(exifDate)
                            val out = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                            out.timeZone = TimeZone.getTimeZone("UTC")
                            parsed?.let { out.format(it) }
                        }.getOrNull()
                    }
                    exif.latLong?.let { ll ->
                        if (ll.size >= 2 && ll.none { it.isNaN() } && !(ll[0] == 0.0 && ll[1] == 0.0)) {
                            lat = ll[0].toDouble()
                            lng = ll[1].toDouble()
                        }
                    }
                }
            }
            val title = if (titlePrefix.isBlank()) name.substringBeforeLast('.') else titlePrefix.trim()
            metadata.put(JSONObject().apply {
                put("title", title.ifBlank { name })
                put("dateSource", if (date != null) "exif" else "file")
                if (date != null) put("date", date)
                if (lat != null && lng != null) { put("lat", lat); put("lng", lng) }
                if (place != null) {
                    put("lat", place.lat)
                    put("lng", place.lng)
                    put("country", place.country)
                    put("countryCode", place.countryCode)
                    put("province", place.province)
                    put("city", place.city)
                    put("district", place.district)
                    put("locationName", place.label)
                }
            })
            parts += name to bytes
        }

        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("metadata", metadata.toString())
        parts.forEach { (name, bytes) ->
            builder.addFormDataPart("files", name, bytes.toRequestBody("image/*".toMediaType()))
        }
        val request = Request.Builder().url("$BASE/api/photos").post(builder.build()).build()
        val text = execute(request)
        return runCatching { JSONObject(text).optJSONArray("photos")?.length() ?: 0 }.getOrDefault(0)
    }
}
