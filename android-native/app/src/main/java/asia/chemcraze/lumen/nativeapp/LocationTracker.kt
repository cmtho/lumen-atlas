package asia.chemcraze.lumen.nativeapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat

data class LocationFix(
    val lat: Double,
    val lng: Double,
    val heading: Float,
    val accuracy: Float,
    val at: Long = System.currentTimeMillis(),
)

class LocationTracker(
    context: Context,
    private val onFix: (LocationFix) -> Unit,
) : LocationListener {
    private val appContext = context.applicationContext
    private val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    private var started = false

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun start() {
        val lm = manager ?: return
        if (started || !hasPermission()) return
        started = true
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        var newest: Location? = null
        for (provider in providers) {
            if (!runCatching { lm.isProviderEnabled(provider) }.getOrDefault(false)) continue
            runCatching {
                lm.getLastKnownLocation(provider)?.let { known ->
                    if (newest == null || known.time > newest!!.time) newest = known
                }
            }
            runCatching {
                lm.requestLocationUpdates(provider, 2_500L, 4f, this, Looper.getMainLooper())
            }
        }
        newest?.let(::publish)
    }

    fun stop() {
        if (!started) return
        started = false
        runCatching { manager?.removeUpdates(this) }
    }

    override fun onLocationChanged(location: Location) {
        publish(location)
    }

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) = Unit

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    private fun publish(location: Location) {
        val heading = if (location.hasBearing()) location.bearing else 0f
        onFix(
            LocationFix(
                lat = location.latitude,
                lng = location.longitude,
                heading = heading,
                accuracy = if (location.hasAccuracy()) location.accuracy else 0f,
                at = System.currentTimeMillis(),
            ),
        )
    }
}
