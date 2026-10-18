package asia.chemcraze.lumen.nativeapp

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory

class LumenApplication : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        Api.init(this)
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .okHttpClient { Api.client }
        .crossfade(true)
        .build()
}
