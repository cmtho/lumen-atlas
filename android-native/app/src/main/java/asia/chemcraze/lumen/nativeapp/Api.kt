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

data class Invite(
    val id: String,
    val code: String,
    val createdAt: String,
    val expiresAt: String,
    val maxUses: Int,
    val uses: Int,
    val revokedAt: String?,
    val active: Boolean,
    val usedBy: List<String>,
) {
    val remaining: Int get() = (maxUses - uses).coerceAtLeast(0)
}

data class AdminUser(
    val id: String,
    val username: String,
    val name: String,
    val role: String,
    val disabled: Boolean,
    val photos: Int,
    val people: Int,
)

data class AdminOverview(
    val users: Int,
    val activeUsers: Int,
    val disabledUsers: Int,
    val photos: Int,
    val people: Int,
    val invites: Int,
    val activeInvites: Int,
    val usedInvites: Int,
    val storageBytes: Long,
)

data class AdminInvite(
    val id: String,
    val code: String,
    val active: Boolean,
    val uses: Int,
    val maxUses: Int,
    val expiresAt: String,
    val creator: String,
    val creatorName: String,
)

data class AdminSettings(
    val siteName: String,
    val tagline: String,
    val description: String,
    val amapKey: String,
    val amapFromEnv: Boolean,
)

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
    val invites: List<Invite>,
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
        val invites = root.optJSONArray("invites") ?: JSONArray()
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
            invites = (0 until invites.length()).map { invites.getJSONObject(it).toInvite() },
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

    private fun JSONObject.toInvite(): Invite {
        val usedBy = mutableListOf<String>()
        optJSONArray("usedBy")?.let { arr -> for (i in 0 until arr.length()) usedBy += arr.optString(i) }
        return Invite(
            id = optString("id"),
            code = optString("code"),
            createdAt = optString("createdAt"),
            expiresAt = optString("expiresAt"),
            maxUses = optInt("maxUses", 1),
            uses = optInt("uses", 0),
            revokedAt = if (isNull("revokedAt")) null else optString("revokedAt"),
            active = optBoolean("active", false),
            usedBy = usedBy,
        )
    }

    private suspend fun patchJson(path: String, body: JSONObject): String {
        return execute(
            Request.Builder().url(BASE + path)
                .patch(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
        )
    }

    suspend fun updateProfile(name: String, handle: String, bio: String, home: String, avatarColor: String? = null): Profile {
        val body = JSONObject().put("name", name).put("handle", handle).put("bio", bio).put("home", home)
        if (avatarColor != null) body.put("avatarColor", avatarColor)
        val text = patchJson("/api/profile", body)
        val p = JSONObject(text).getJSONObject("profile")
        return Profile(
            name = p.optString("name", "旅人"),
            handle = p.optString("handle", ""),
            bio = p.optString("bio", ""),
            home = p.optString("home", ""),
            avatarColor = p.optString("avatarColor", "#65f4ff"),
            avatarUrl = p.optString("avatarUrl").takeIf { it.isNotBlank() }?.absolute(),
        )
    }

    suspend fun createInvite(expiresDays: Int, maxUses: Int): Invite {
        val body = JSONObject().put("expiresDays", expiresDays).put("maxUses", maxUses)
        val text = execute(
            Request.Builder().url("$BASE/api/invites")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
        )
        return JSONObject(text).getJSONObject("invite").toInvite()
    }

    suspend fun revokeInvite(id: String) {
        execute(Request.Builder().url("$BASE/api/invites/$id").delete().build())
    }

    suspend fun adminUsers(): List<AdminUser> {
        val text = execute(Request.Builder().url("$BASE/api/admin/users").get().build())
        val arr = JSONObject(text).optJSONArray("users") ?: return emptyList()
        return (0 until arr.length()).map {
            val u = arr.getJSONObject(it)
            AdminUser(
                id = u.optString("id"),
                username = u.optString("username"),
                name = u.optString("name", u.optString("username")),
                role = u.optString("role", "member"),
                disabled = u.optBoolean("disabled", false),
                photos = u.optInt("photos", 0),
                people = u.optInt("people", 0),
            )
        }
    }

    suspend fun adminUpdateUser(id: String, role: String? = null, disabled: Boolean? = null) {
        val body = JSONObject()
        if (role != null) body.put("role", role)
        if (disabled != null) body.put("disabled", disabled)
        patchJson("/api/admin/users/$id", body)
    }

    suspend fun adminDeleteUser(id: String) {
        execute(Request.Builder().url("$BASE/api/admin/users/$id").delete().build())
    }

    suspend fun uploadAvatar(context: Context, uri: Uri): String {
        val resolver = context.contentResolver
        val bytes = withContext(Dispatchers.IO) {
            resolver.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiException("无法读取头像")
        }
        val name = runCatching {
            resolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) c.getString(idx) else null
                } else null
            }
        }.getOrNull() ?: "avatar.jpg"
        val mime = resolver.getType(uri) ?: "image/jpeg"
        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("avatar", name, bytes.toRequestBody(mime.toMediaType()))
            .build()
        val text = execute(Request.Builder().url("$BASE/api/profile/avatar").post(body).build())
        return JSONObject(text).optString("avatarUrl").absolute()
    }

    suspend fun deleteAvatar() {
        execute(Request.Builder().url("$BASE/api/profile/avatar").delete().build())
    }

    suspend fun adminOverview(): AdminOverview {
        val text = execute(Request.Builder().url("$BASE/api/admin/overview").get().build())
        val root = JSONObject(text)
        val users = root.optJSONObject("users")
        val invites = root.optJSONObject("invites")
        val storage = root.optJSONObject("storage")
        return AdminOverview(
            users = users?.optInt("total", 0) ?: 0,
            activeUsers = users?.optInt("active", 0) ?: 0,
            disabledUsers = users?.optInt("disabled", 0) ?: 0,
            photos = root.optInt("photos", 0),
            people = root.optInt("people", 0),
            invites = invites?.optInt("total", 0) ?: 0,
            activeInvites = invites?.optInt("active", 0) ?: 0,
            usedInvites = invites?.optInt("used", 0) ?: 0,
            storageBytes = storage?.optLong("total", 0L) ?: 0L,
        )
    }

    suspend fun adminInvites(): List<AdminInvite> {
        val text = execute(Request.Builder().url("$BASE/api/admin/invites").get().build())
        val arr = JSONObject(text).optJSONArray("invites") ?: return emptyList()
        return (0 until arr.length()).map {
            val i = arr.getJSONObject(it)
            AdminInvite(
                id = i.optString("id"),
                code = i.optString("code"),
                active = i.optBoolean("active", false),
                uses = i.optInt("uses", 0),
                maxUses = i.optInt("maxUses", 1),
                expiresAt = i.optString("expiresAt"),
                creator = i.optString("creator", "unknown"),
                creatorName = i.optString("creatorName", ""),
            )
        }
    }

    suspend fun adminRevokeInvite(id: String) {
        execute(Request.Builder().url("$BASE/api/admin/invites/$id").delete().build())
    }

    suspend fun resetPassword(id: String): String {
        val text = execute(Request.Builder().url("$BASE/api/admin/users/$id/reset-password").post("{}".toRequestBody("application/json".toMediaType())).build())
        return JSONObject(text).optString("temporaryPassword")
    }

    suspend fun adminSettings(): AdminSettings {
        val text = execute(Request.Builder().url("$BASE/api/admin/settings").get().build())
        val root = JSONObject(text)
        val s = root.getJSONObject("settings")
        return AdminSettings(
            siteName = s.optString("siteName"),
            tagline = s.optString("tagline"),
            description = s.optString("description"),
            amapKey = s.optString("amapKey"),
            amapFromEnv = root.optBoolean("amapFromEnv", false),
        )
    }

    suspend fun updateAdminSettings(siteName: String, tagline: String, description: String, amapKey: String): AdminSettings {
        val body = JSONObject().put("siteName", siteName).put("tagline", tagline).put("description", description).put("amapKey", amapKey)
        val text = patchJson("/api/admin/settings", body)
        val root = JSONObject(text)
        val s = root.getJSONObject("settings")
        return AdminSettings(
            siteName = s.optString("siteName"),
            tagline = s.optString("tagline"),
            description = s.optString("description"),
            amapKey = s.optString("amapKey"),
            amapFromEnv = root.optBoolean("amapFromEnv", false),
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
