package asia.chemcraze.lumen.nativeapp

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch

private val Bg = Color(0xFF030811)
private val Panel = Color(0xFF0A1725)
private val Cyan = Color(0xFF65F4FF)
private val Violet = Color(0xFF9C8CFF)
private val Ink = Color(0xFFEAFBFF)
private val Soft = Color(0xFF8AABC0)
private val Danger = Color(0xFFFF8EA8)

private val LumenColors = darkColorScheme(
    primary = Cyan,
    secondary = Violet,
    background = Bg,
    surface = Panel,
    onPrimary = Color(0xFF031018),
    onBackground = Ink,
    onSurface = Ink,
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = LumenColors) {
                LumenRoot()
            }
        }
    }
}

private sealed interface RootState {
    data object Loading : RootState
    data object Login : RootState
    data class Main(val data: Bootstrap) : RootState
}

@Composable
private fun LumenRoot() {
    var state by remember { mutableStateOf<RootState>(RootState.Loading) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        state = if (Api.hasSession()) {
            runCatching { Api.bootstrap() }.fold(
                onSuccess = { RootState.Main(it) },
                onFailure = { RootState.Login },
            )
        } else RootState.Login
    }

    when (val current = state) {
        RootState.Loading -> LoadingScreen()
        RootState.Login -> LoginScreen(
            onLoggedIn = { data -> state = RootState.Main(data) },
        )
        is RootState.Main -> MainScreen(
            initial = current.data,
            onLogout = {
                Api.clear()
                state = RootState.Login
            },
            onUpdated = { data -> state = RootState.Main(data) },
        )
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF071421), Bg))),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            OrbitMark(78)
            Text("LUMEN ATLAS", color = Ink, fontSize = 20.sp, letterSpacing = 5.sp, fontWeight = FontWeight.Medium)
            CircularProgressIndicator(color = Cyan, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        }
    }
}

@Composable
private fun OrbitMark(size: Int = 64) {
    Canvas(Modifier.size(size.dp)) {
        val r = this.size.minDimension / 2f
        drawCircle(color = Cyan.copy(alpha = .06f), radius = r)
        drawCircle(color = Cyan.copy(alpha = .85f), radius = r * .66f, style = Stroke(width = 1.6.dp.toPx()))
        rotate(-28f) {
            drawOval(
                color = Violet.copy(alpha = .72f),
                topLeft = Offset(r * .08f, r * .68f),
                size = Size(r * 1.84f, r * .64f),
                style = Stroke(width = 1.1.dp.toPx()),
            )
        }
        drawCircle(color = Cyan, radius = r * .17f)
        drawCircle(color = Cyan.copy(alpha = .25f), radius = r * .3f, style = Stroke(width = 1.dp.toPx()))
    }
}

@Composable
private fun LoginScreen(onLoggedIn: (Bootstrap) -> Unit) {
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun submit() {
        if (busy) return
        if (username.isBlank() || password.isBlank()) {
            error = "请输入用户名和密码"
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                Api.login(username, password)
                val data = Api.bootstrap()
                onLoggedIn(data)
            } catch (e: Exception) {
                error = e.message ?: "登录失败"
            } finally {
                busy = false
            }
        }
    }

    Box(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF071421), Bg, Color(0xFF02050B))))
            .statusBarsPadding()
            .imePadding()
            .padding(22.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            OrbitMark(105)
            Spacer(Modifier.height(20.dp))
            Text("LUMEN ATLAS", color = Ink, fontSize = 30.sp, letterSpacing = 5.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(7.dp))
            Text("流光坐标 · PERSONAL ORBIT", color = Soft, fontSize = 11.sp, letterSpacing = 2.sp)
            Spacer(Modifier.height(30.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("登录你的私人星图", color = Ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                    Text("使用 LUMEN ATLAS 账号继续", color = Soft, fontSize = 12.sp)
                    LumenField(
                        value = username,
                        onChange = { username = it; error = null },
                        label = "用户名",
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next,
                    )
                    LumenField(
                        value = password,
                        onChange = { password = it; error = null },
                        label = "密码",
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                        password = true,
                        onDone = { submit() },
                    )
                    if (error != null) Text(error!!, color = Danger, fontSize = 12.sp)
                    Button(
                        onClick = { submit() },
                        enabled = !busy,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Color(0xFF031018)),
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(19.dp), color = Color(0xFF031018), strokeWidth = 2.dp)
                        else Text("进入星图", fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(18.dp))
            Text("原生 Android 客户端 · 球体地图由 LUMEN 提供", color = Soft.copy(alpha = .7f), fontSize = 10.sp)
        }
    }
}

@Composable
private fun LumenField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    password: Boolean = false,
    onDone: (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Cyan,
            unfocusedBorderColor = Color.White.copy(alpha = .14f),
            focusedLabelColor = Cyan,
            unfocusedLabelColor = Soft,
            cursorColor = Cyan,
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Color(0xFF06111D),
            unfocusedContainerColor = Color(0xFF06111D),
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun MainScreen(initial: Bootstrap, onLogout: () -> Unit, onUpdated: (Bootstrap) -> Unit) {
    var data by remember { mutableStateOf(initial) }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var selectedPhoto by remember { mutableStateOf<Photo?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun refresh() {
        if (refreshing) return
        refreshing = true
        scope.launch {
            try { data = Api.bootstrap() } catch (_: Exception) {}
            refreshing = false
        }
    }

    Box(Modifier.fillMaxSize().background(Bg)) {
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = {
                NavigationBar(containerColor = Color(0xF2071421), tonalElevation = 0.dp) {
                    val items = listOf(
                        Triple("星图", Icons.Outlined.Public, 0),
                        Triple("档案", Icons.Outlined.PhotoLibrary, 1),
                        Triple("上传", Icons.Outlined.AddCircleOutline, 2),
                        Triple("我的", Icons.Outlined.PersonOutline, 3),
                    )
                    items.forEach { (label, icon, index) ->
                        NavigationBarItem(
                            selected = tab == index,
                            onClick = { tab = index },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Cyan,
                                selectedTextColor = Cyan,
                                indicatorColor = Cyan.copy(alpha = .12f),
                                unselectedIconColor = Soft,
                                unselectedTextColor = Soft,
                            ),
                        )
                    }
                }
            },
        ) { inner ->
            Box(Modifier.fillMaxSize().padding(inner)) {
                when (tab) {
                    0 -> GlobeScreen(data, onPhoto = { selectedPhoto = it })
                    1 -> ArchiveScreen(data, onPhoto = { selectedPhoto = it }, onRefresh = { refresh() })
                    2 -> UploadScreen(
                        onUploaded = { count ->
                            refresh()
                            tab = 1
                        },
                    )
                    else -> ProfileScreen(
                        data = data,
                        onRefresh = { refresh() },
                        onOpenWeb = {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Api.BASE)))
                        },
                        onLogout = onLogout,
                    )
                }
            }
        }
    }

    selectedPhoto?.let { photo ->
        PhotoDialog(photo = photo, onClose = { selectedPhoto = null })
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun GlobeScreen(data: Bootstrap, onPhoto: (Photo) -> Unit) {
    val context = LocalContext.current
    val loading = remember { mutableStateOf(true) }
    var provider by rememberSaveable { mutableStateOf("libre") }
    val webView = remember {
        WebView(context).apply {
            setBackgroundColor(0xFF02060E.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportZoom(false)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) { loading.value = false }
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url ?: return false
                    if (url.host == "lumen.chemcraze.asia") return false
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    return true
                }
            }
            webChromeClient = WebChromeClient()
        }
    }

    LaunchedEffect(provider) {
        loading.value = true
        Api.syncWebViewCookie()
        webView.loadUrl("${Api.BASE}/?embed=map&provider=$provider&v=native2")
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching {
                webView.stopLoading()
                webView.loadUrl("about:blank")
                webView.destroy()
            }
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF02060E))) {
        AndroidView(factory = { webView }, modifier = Modifier.fillMaxSize())
        Box(
            Modifier.fillMaxWidth().height(300.dp).align(Alignment.TopCenter)
                .background(Brush.verticalGradient(listOf(Color(0xE6030811), Color(0x99030811), Color.Transparent))),
        )
        Box(
            Modifier.fillMaxWidth().height(190.dp).align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC030811)))),
        )
        Column(
            Modifier.statusBarsPadding().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GlassCard {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    OrbitMark(30)
                    Spacer(Modifier.width(9.dp))
                    Column {
                        Text("LUMEN ATLAS", color = Ink, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.SemiBold)
                        Text(if (provider == "libre") "全球球体 / 原生客户端" else "高德中国底图 / 原生客户端", color = Soft, fontSize = 9.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    Text("${data.photos.size} 帧", color = Cyan, fontSize = 10.sp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                ProviderPill("LUMEN 球体", provider == "libre") { provider = "libre" }
                ProviderPill("高德中国", provider == "amap") { provider = "amap" }
            }
            Text("拖拽旋转 · 双指缩放", color = Soft.copy(alpha = .8f), fontSize = 9.sp, modifier = Modifier.padding(start = 4.dp))
        }

        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
            Text(
                if (provider == "libre") "© OpenStreetMap · OpenFreeMap · MapLibre" else "© 高德地图 · MapLibre / OSM contributors",
                color = Color.White.copy(alpha = .55f),
                fontSize = 8.sp,
                modifier = Modifier.padding(horizontal = 13.dp, vertical = 5.dp),
            )
            if (data.photos.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().background(Color(0xCC06111D)),
                ) {
                    items(data.photos.take(12), key = { it.id }) { photo ->
                        Box(
                            Modifier.size(68.dp).clip(RoundedCornerShape(10.dp))
                                .border(1.dp, Color.White.copy(alpha = .16f), RoundedCornerShape(10.dp))
                                .clickable { onPhoto(photo) },
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(context).data(photo.thumb).crossfade(true).build(),
                                contentDescription = photo.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                }
            }
        }

        if (loading.value) {
            CircularProgressIndicator(color = Cyan, strokeWidth = 2.dp, modifier = Modifier.align(Alignment.Center).size(25.dp))
        }
    }
}

@Composable
private fun ProviderPill(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).background(if (active) Color(0xE60A1725) else Color(0xB306111D))
            .border(1.dp, if (active) Cyan.copy(alpha = .45f) else Color.White.copy(alpha = .12f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 8.dp),
    ) {
        Text(label, color = if (active) Cyan else Soft, fontSize = 10.sp)
    }
}

@Composable
private fun ArchiveScreen(data: Bootstrap, onPhoto: (Photo) -> Unit, onRefresh: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val filtered = remember(query, data.photos) {
        val term = query.trim().lowercase()
        if (term.isBlank()) data.photos else data.photos.filter {
            listOf(it.title, it.place, it.tags.joinToString(" ")).joinToString(" ").lowercase().contains(term)
        }
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(16.dp, 16.dp, 16.dp, 28.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("影像档案", color = Ink, fontSize = 30.sp, fontWeight = FontWeight.Light, letterSpacing = (-1).sp)
                        Text("${filtered.size} 个坐标 · ${data.people.size} 位旅人", color = Soft, fontSize = 11.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "刷新", tint = Soft) }
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    placeholder = { Text("搜索标题、地点、标签", fontSize = 12.sp, color = Soft) },
                    leadingIcon = { Icon(Icons.Outlined.Search, null, tint = Soft) },
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Cyan,
                        unfocusedBorderColor = Color.White.copy(alpha = .14f),
                        focusedTextColor = Ink,
                        unfocusedTextColor = Ink,
                        focusedContainerColor = Color(0xFF06111D),
                        unfocusedContainerColor = Color(0xFF06111D),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        if (filtered.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Outlined.PhotoLibrary, null, tint = Cyan, modifier = Modifier.size(38.dp))
                        Spacer(Modifier.height(12.dp))
                        Text(if (data.photos.isEmpty()) "这里还没有影像" else "没有匹配的影像", color = Ink, fontSize = 16.sp)
                        Text(if (data.photos.isEmpty()) "从下方“上传”写入第一张照片" else "换一个关键词试试", color = Soft, fontSize = 11.sp)
                    }
                }
            }
        }
        items(filtered, key = { it.id }) { photo ->
            PhotoCard(photo, onClick = { onPhoto(photo) })
        }
    }
}

@Composable
private fun PhotoCard(photo: Photo, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().aspectRatio(.78f).clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF0A1725)).border(1.dp, Color.White.copy(alpha = .1f), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick),
    ) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current).data(photo.thumb).crossfade(true).build(),
            contentDescription = photo.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Color(0xE6030811)))))
        Column(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
            Text(photo.title, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(photo.place, color = Soft, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun UploadScreen(onUploaded: (Int) -> Unit) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var title by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var showPlaceSearch by remember { mutableStateOf(false) }
    var placeQuery by remember { mutableStateOf("") }
    var placeResults by remember { mutableStateOf<List<PlaceResult>>(emptyList()) }
    var placeSearching by remember { mutableStateOf(false) }
    var selectedPlace by remember { mutableStateOf<PlaceResult?>(null) }
    val scope = rememberCoroutineScope()
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(10),
    ) { uris -> selected = uris; error = null; message = null }

    fun searchPlace() {
        if (placeQuery.trim().length < 2 || placeSearching) return
        placeSearching = true
        error = null
        scope.launch {
            try { placeResults = Api.searchPlaces(placeQuery) }
            catch (e: Exception) { error = e.message ?: "搜索失败" }
            finally { placeSearching = false }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 16.dp, 16.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("写入新坐标", color = Ink, fontSize = 30.sp, fontWeight = FontWeight.Light, letterSpacing = (-1).sp)
        Text("从相册选择照片，自动读取 EXIF 日期与 GPS", color = Soft, fontSize = 11.sp)
        GlassCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                Button(
                    onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    shape = RoundedCornerShape(13.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = .08f), contentColor = Cyan),
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                ) {
                    Icon(Icons.Outlined.AddCircleOutline, null)
                    Spacer(Modifier.width(7.dp))
                    Text(if (selected.isEmpty()) "选择照片" else "重新选择 (${selected.size})", fontSize = 12.sp)
                }
                if (selected.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(selected) { uri ->
                            AsyncImage(
                                model = uri,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(82.dp).clip(RoundedCornerShape(10.dp)),
                            )
                        }
                    }
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("标题前缀（可选）") },
                        singleLine = true,
                        shape = RoundedCornerShape(13.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Cyan,
                            unfocusedBorderColor = Color.White.copy(alpha = .14f),
                            focusedTextColor = Ink,
                            unfocusedTextColor = Ink,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (selectedPlace != null) {
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp))
                                .background(Cyan.copy(alpha = .08f))
                                .border(1.dp, Cyan.copy(alpha = .25f), RoundedCornerShape(11.dp))
                                .padding(11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.LocationOn, null, tint = Cyan, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(7.dp))
                            Column(Modifier.weight(1f)) {
                                Text(selectedPlace!!.label, color = Ink, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(selectedPlace!!.detail, color = Soft, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            IconButton(onClick = { selectedPlace = null }, modifier = Modifier.size(26.dp)) {
                                Icon(Icons.Outlined.Close, "清除地点", tint = Soft, modifier = Modifier.size(15.dp))
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = { showPlaceSearch = !showPlaceSearch },
                        shape = RoundedCornerShape(11.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Outlined.LocationOn, null, tint = Cyan, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(if (selectedPlace == null) "搜索地点（可选）" else "更换地点", color = Ink, fontSize = 11.sp)
                    }

                    if (showPlaceSearch) {
                        OutlinedTextField(
                            value = placeQuery,
                            onValueChange = { placeQuery = it },
                            singleLine = true,
                            placeholder = { Text("城市、地标或地址", fontSize = 11.sp, color = Soft) },
                            leadingIcon = { Icon(Icons.Outlined.Search, null, tint = Soft) },
                            trailingIcon = {
                                TextButton(onClick = { searchPlace() }) {
                                    if (placeSearching) CircularProgressIndicator(Modifier.size(15.dp), color = Cyan, strokeWidth = 2.dp)
                                    else Text("搜索", color = Cyan, fontSize = 10.sp)
                                }
                            },
                            shape = RoundedCornerShape(13.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Cyan,
                                unfocusedBorderColor = Color.White.copy(alpha = .14f),
                                focusedTextColor = Ink,
                                unfocusedTextColor = Ink,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        placeResults.take(5).forEach { place ->
                            Column(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                    .clickable {
                                        selectedPlace = place
                                        showPlaceSearch = false
                                        placeResults = emptyList()
                                    }
                                    .background(Color.White.copy(alpha = .045f))
                                    .padding(10.dp),
                            ) {
                                Text(place.label, color = Ink, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                Text(place.detail, color = Soft, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }

                    Text(
                        if (selectedPlace == null) "没有 GPS 的照片不会自动定位，可搜索地点后统一写入。" else "这组照片将写入所选地点；单张 EXIF GPS 会被覆盖。",
                        color = Soft,
                        fontSize = 9.sp,
                    )
                    Button(
                        onClick = {
                            busy = true; error = null; message = null
                            scope.launch {
                                try {
                                    val count = Api.upload(context, selected, title, selectedPlace)
                                    selected = emptyList(); title = ""; selectedPlace = null
                                    message = "已写入 $count 张影像"
                                    onUploaded(count)
                                } catch (e: Exception) {
                                    error = e.message ?: "上传失败"
                                } finally { busy = false }
                            }
                        },
                        enabled = !busy,
                        shape = RoundedCornerShape(13.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Color(0xFF031018)),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(19.dp), color = Color(0xFF031018), strokeWidth = 2.dp)
                        else Text("上传到星图", fontWeight = FontWeight.Bold)
                    }
                }
                if (message != null) Text(message!!, color = Cyan, fontSize = 11.sp)
                if (error != null) Text(error!!, color = Danger, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ProfileScreen(data: Bootstrap, onRefresh: () -> Unit, onOpenWeb: () -> Unit, onLogout: () -> Unit) {
    val profile = data.profile
    val countries = data.photos.map { it.country }.filter { it.isNotBlank() }.distinct().size
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 16.dp, 16.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("我的", color = Ink, fontSize = 30.sp, fontWeight = FontWeight.Light, letterSpacing = (-1).sp)
        GlassCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (profile.avatarUrl != null) {
                    AsyncImage(
                        model = profile.avatarUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(84.dp).clip(CircleShape).border(1.dp, Cyan.copy(alpha = .35f), CircleShape),
                    )
                } else {
                    Box(
                        Modifier.size(84.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Cyan, Violet))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(profile.name.take(1), color = Color(0xFF031018), fontSize = 30.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(14.dp))
                Text(profile.name, color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Medium)
                Text("@${data.account.username} · ${data.account.role.uppercase()}", color = Soft, fontSize = 10.sp, letterSpacing = 1.sp)
                if (profile.bio.isNotBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Text(profile.bio, color = Soft, fontSize = 11.sp, lineHeight = 17.sp)
                }
                if (profile.home.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(profile.home, color = Soft.copy(alpha = .8f), fontSize = 10.sp)
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            StatCard("${data.photos.size}", "影像", Modifier.weight(1f))
            StatCard("${data.people.size}", "旅人", Modifier.weight(1f))
            StatCard("$countries", "国家", Modifier.weight(1f))
        }
        GlassCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(13.dp)) {
                    Icon(Icons.Outlined.Refresh, null, tint = Soft); Spacer(Modifier.width(7.dp)); Text("刷新数据", color = Ink)
                }
                OutlinedButton(onClick = onOpenWeb, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(13.dp)) {
                    Icon(Icons.Outlined.Language, null, tint = Soft); Spacer(Modifier.width(7.dp)); Text("打开网页版 / 管理后台", color = Ink)
                }
                TextButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.ExitToApp, null, tint = Danger); Spacer(Modifier.width(7.dp)); Text("退出登录", color = Danger)
                }
            }
        }
        Text("LUMEN ATLAS · 原生 Android UI", color = Soft.copy(alpha = .6f), fontSize = 9.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}

@Composable
private fun StatCard(value: String, label: String, modifier: Modifier = Modifier) {
    GlassCard(modifier) {
        Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = Ink, fontSize = 23.sp, fontWeight = FontWeight.Light)
            Text(label, color = Soft, fontSize = 9.sp)
        }
    }
}

@Composable
private fun PhotoDialog(photo: Photo, onClose: () -> Unit) {
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xFF010409))) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current).data(photo.image).crossfade(true).build(),
                contentDescription = photo.title,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
            Row(Modifier.statusBarsPadding().padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onClose, modifier = Modifier.background(Color.Black.copy(alpha = .45f), CircleShape)) {
                    Icon(Icons.Outlined.ArrowBack, "返回", tint = Color.White)
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onClose, modifier = Modifier.background(Color.Black.copy(alpha = .45f), CircleShape)) {
                    Icon(Icons.Outlined.Close, "关闭", tint = Color.White)
                }
            }
            Column(
                Modifier.align(Alignment.BottomStart).fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xF0010409))))
                    .navigationBarsPadding().padding(20.dp),
            ) {
                Text(photo.title, color = Ink, fontSize = 22.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(4.dp))
                Text(photo.place, color = Cyan.copy(alpha = .85f), fontSize = 11.sp)
                if (photo.capturedAt.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(photo.capturedAt.take(10), color = Soft, fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun GlassCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        modifier = modifier,
        color = Color.White.copy(alpha = .055f),
        shape = RoundedCornerShape(22.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = .11f)),
    ) { content() }
}
