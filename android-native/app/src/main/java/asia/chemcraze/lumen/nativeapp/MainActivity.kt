package asia.chemcraze.lumen.nativeapp

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
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
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogWindowProvider
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
    var showSearch by remember { mutableStateOf(false) }
    var showInvites by remember { mutableStateOf(false) }
    var showAdmin by remember { mutableStateOf(false) }
    var showEdit by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    val isStaff = data.account.role == "owner" || data.account.role == "admin"
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
                    0 -> GlobeScreen(data, onPhoto = { selectedPhoto = it }, onSearch = { showSearch = true })
                    1 -> ArchiveScreen(data, onPhoto = { selectedPhoto = it }, onRefresh = { refresh() })
                    2 -> UploadScreen(
                        onUploaded = { count ->
                            refresh()
                            tab = 1
                        },
                    )
                    else -> ProfileScreen(
                        data = data,
                        isStaff = isStaff,
                        onRefresh = { refresh() },
                        onEdit = { showEdit = true },
                        onInvites = { showInvites = true },
                        onAdmin = { showAdmin = true },
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
    if (showSearch) {
        SearchDialog(data = data, onPhoto = { selectedPhoto = it; showSearch = false }, onClose = { showSearch = false })
    }
    if (showEdit) {
        EditProfileDialog(
            profile = data.profile,
            onSaved = { data = data.copy(profile = it); showEdit = false },
            onClose = { showEdit = false },
        )
    }
    if (showInvites) {
        InviteDialog(
            siteOrigin = Api.BASE,
            initial = data.invites,
            onUpdated = { data = data.copy(invites = it) },
            onClose = { showInvites = false },
        )
    }
    if (showAdmin && isStaff) {
        AdminDialog(
            currentUsername = data.account.username,
            currentRole = data.account.role,
            onClose = { showAdmin = false },
        )
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun GlobeScreen(data: Bootstrap, onPhoto: (Photo) -> Unit, onSearch: () -> Unit) {
    val context = LocalContext.current
    val loading = remember { mutableStateOf(true) }
    var provider by rememberSaveable { mutableStateOf("libre") }
    val latestData = rememberUpdatedState(data)
    val latestOnPhoto = rememberUpdatedState(onPhoto)
    val webView = remember {
        WebView(context).apply {
            addJavascriptInterface(object {
                @JavascriptInterface
                fun openPhoto(id: String) {
                    Handler(Looper.getMainLooper()).post {
                        latestData.value.photos.firstOrNull { it.id == id }?.let { latestOnPhoto.value(it) }
                    }
                }
            }, "LumenBridge")
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
                    IconButton(onClick = onSearch, modifier = Modifier.size(30.dp)) {
                        Icon(Icons.Outlined.Search, "搜索", tint = Cyan, modifier = Modifier.size(17.dp))
                    }
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
                Text("最近影像 · 点击查看", color = Cyan.copy(alpha = .9f), fontSize = 8.sp, modifier = Modifier.padding(start = 13.dp, top = 5.dp))
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
    var personId by rememberSaveable { mutableStateOf<String?>(null) }
    val filtered = remember(query, personId, data.photos) {
        val term = query.trim().lowercase()
        data.photos.filter { photo ->
            val matchesQuery = term.isBlank() || listOf(photo.title, photo.place, photo.tags.joinToString(" "))
                .joinToString(" ").lowercase().contains(term)
            val matchesPerson = personId == null || photo.personIds.contains(personId)
            matchesQuery && matchesPerson
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
            Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
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
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    item {
                        PersonFilterChip("全部", null, active = personId == null) { personId = null }
                    }
                    items(data.people, key = { it.id }) { person ->
                        PersonFilterChip(person.name, parseHex(person.color), active = personId == person.id) {
                            personId = if (personId == person.id) null else person.id
                        }
                    }
                }
            }
        }
        if (filtered.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Outlined.PhotoLibrary, null, tint = Cyan, modifier = Modifier.size(38.dp))
                        Spacer(Modifier.height(12.dp))
                        Text(if (data.photos.isEmpty()) "这里还没有影像" else "没有匹配的影像", color = Ink, fontSize = 16.sp)
                        Text(if (data.photos.isEmpty()) "从下方“上传”写入第一张照片" else "换关键词或人物试试", color = Soft, fontSize = 11.sp)
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
private fun PersonFilterChip(label: String, color: Color?, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(50))
            .background(if (active) Color(0xE60A1725) else Color(0x9906111D))
            .border(1.dp, if (active) Cyan.copy(alpha = .5f) else Color.White.copy(alpha = .12f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (color != null) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(5.dp))
        }
        Text(label, color = if (active) Cyan else Soft, fontSize = 10.sp)
    }
}

private fun parseHex(value: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(value))
}.getOrDefault(Cyan)

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
private fun ProfileScreen(data: Bootstrap, isStaff: Boolean, onRefresh: () -> Unit, onEdit: () -> Unit, onInvites: () -> Unit, onAdmin: () -> Unit, onOpenWeb: () -> Unit, onLogout: () -> Unit) {
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
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(12.dp)) {
                        Icon(Icons.Outlined.Edit, null, tint = Cyan, modifier = Modifier.size(15.dp)); Spacer(Modifier.width(5.dp)); Text("编辑资料", color = Ink, fontSize = 11.sp)
                    }
                    OutlinedButton(onClick = onInvites, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(12.dp)) {
                        Icon(Icons.Outlined.Group, null, tint = Cyan, modifier = Modifier.size(15.dp)); Spacer(Modifier.width(5.dp)); Text("邀请码", color = Ink, fontSize = 11.sp)
                    }
                }
                if (isStaff) {
                    OutlinedButton(onClick = onAdmin, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(13.dp)) {
                        Icon(Icons.Outlined.AdminPanelSettings, null, tint = Violet); Spacer(Modifier.width(7.dp)); Text("后台管理", color = Ink)
                    }
                }
                OutlinedButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(13.dp)) {
                    Icon(Icons.Outlined.Refresh, null, tint = Soft); Spacer(Modifier.width(7.dp)); Text("刷新数据", color = Ink)
                }
                OutlinedButton(onClick = onOpenWeb, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(13.dp)) {
                    Icon(Icons.Outlined.Language, null, tint = Soft); Spacer(Modifier.width(7.dp)); Text("打开网页版", color = Ink)
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
private fun SearchDialog(data: Bootstrap, onPhoto: (Photo) -> Unit, onClose: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val peopleById = remember(data.people) { data.people.associateBy { it.id } }
    val results = remember(query, data.photos) {
        val term = query.trim().lowercase()
        if (term.isBlank()) data.photos.take(20) else data.photos.filter { photo ->
            val personNames = photo.personIds.mapNotNull { peopleById[it]?.name }.joinToString(" ")
            listOf(photo.title, photo.place, photo.tags.joinToString(" "), personNames).joinToString(" ").lowercase().contains(term)
        }
    }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Bg)) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) { Icon(Icons.Outlined.ArrowBack, "返回", tint = Ink) }
                    Text("搜索", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Light)
                    Spacer(Modifier.weight(1f))
                    Text("${results.size} 条", color = Soft, fontSize = 10.sp)
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    placeholder = { Text("影像、地点、人物、标签", fontSize = 12.sp, color = Soft) },
                    leadingIcon = { Icon(Icons.Outlined.Search, null, tint = Cyan) },
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
                if (data.people.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        items(data.people, key = { it.id }) { person ->
                            PersonFilterChip(person.name, parseHex(person.color), active = false) {
                                query = person.name
                            }
                        }
                    }
                }
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(results, key = { it.id }) { photo ->
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = .045f))
                                .clickable { onPhoto(photo) }
                                .padding(9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current).data(photo.thumb).crossfade(true).build(),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(56.dp).clip(RoundedCornerShape(9.dp)),
                            )
                            Spacer(Modifier.width(11.dp))
                            Column(Modifier.weight(1f)) {
                                Text(photo.title, color = Ink, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(photo.place, color = Soft, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    if (results.isEmpty()) {
                        item {
                            GlassCard(Modifier.fillMaxWidth()) {
                                Text("没有匹配的影像", color = Soft, fontSize = 12.sp, modifier = Modifier.padding(24.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EditProfileDialog(profile: Profile, onSaved: (Profile) -> Unit, onClose: () -> Unit) {
    var name by remember { mutableStateOf(profile.name) }
    var handle by remember { mutableStateOf(profile.handle) }
    var bio by remember { mutableStateOf(profile.bio) }
    var home by remember { mutableStateOf(profile.home) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Bg)) {
            Column(
                Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()
                    .verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) { Icon(Icons.Outlined.ArrowBack, "返回", tint = Ink) }
                    Text("编辑资料", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Light)
                }
                Text("头像仍可在网页版个人页更换。", color = Soft, fontSize = 9.sp)
                LumenField(name, { name = it }, "显示名称")
                LumenField(handle, { handle = it }, "Handle / 用户名别名")
                LumenField(home, { home = it }, "所在城市 / 家乡")
                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it },
                    label = { Text("个人简介") },
                    minLines = 3,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Cyan,
                        unfocusedBorderColor = Color.White.copy(alpha = .14f),
                        focusedLabelColor = Cyan,
                        unfocusedLabelColor = Soft,
                        focusedTextColor = Ink,
                        unfocusedTextColor = Ink,
                        focusedContainerColor = Color(0xFF06111D),
                        unfocusedContainerColor = Color(0xFF06111D),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (error != null) Text(error!!, color = Danger, fontSize = 11.sp)
                Button(
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            try { onSaved(Api.updateProfile(name, handle, bio, home)) }
                            catch (e: Exception) { error = e.message ?: "保存失败" }
                            finally { busy = false }
                        }
                    },
                    enabled = !busy,
                    shape = RoundedCornerShape(13.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Color(0xFF031018)),
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(19.dp), color = Color(0xFF031018), strokeWidth = 2.dp)
                    else Text("保存资料", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun InviteDialog(siteOrigin: String, initial: List<Invite>, onUpdated: (List<Invite>) -> Unit, onClose: () -> Unit) {
    var invites by remember { mutableStateOf(initial) }
    var days by remember { mutableStateOf("14") }
    var uses by remember { mutableStateOf("1") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Bg)) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) { Icon(Icons.Outlined.ArrowBack, "返回", tint = Ink) }
                    Text("邀请码", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Light)
                    Spacer(Modifier.weight(1f))
                    Text("${invites.size} 个", color = Soft, fontSize = 10.sp)
                }
                GlassCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("生成新邀请码", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = days,
                                onValueChange = { days = it.filter(Char::isDigit).take(3) },
                                label = { Text("有效期 / 天") },
                                singleLine = true,
                                shape = RoundedCornerShape(11.dp),
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Cyan, unfocusedBorderColor = Color.White.copy(alpha = .14f), focusedTextColor = Ink, unfocusedTextColor = Ink),
                            )
                            OutlinedTextField(
                                value = uses,
                                onValueChange = { uses = it.filter(Char::isDigit).take(3) },
                                label = { Text("可用次数") },
                                singleLine = true,
                                shape = RoundedCornerShape(11.dp),
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Cyan, unfocusedBorderColor = Color.White.copy(alpha = .14f), focusedTextColor = Ink, unfocusedTextColor = Ink),
                            )
                        }
                        Button(
                            onClick = {
                                busy = true; error = null
                                scope.launch {
                                    try {
                                        val created = Api.createInvite((days.toIntOrNull() ?: 14).coerceIn(1, 365), (uses.toIntOrNull() ?: 1).coerceIn(1, 100))
                                        invites = listOf(created) + invites
                                        onUpdated(invites)
                                    } catch (e: Exception) { error = e.message ?: "生成失败" }
                                    finally { busy = false }
                                }
                            },
                            enabled = !busy,
                            shape = RoundedCornerShape(11.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Color(0xFF031018)),
                            modifier = Modifier.fillMaxWidth().height(44.dp),
                        ) {
                            if (busy) CircularProgressIndicator(Modifier.size(17.dp), color = Color(0xFF031018), strokeWidth = 2.dp)
                            else Text("生成邀请码", fontWeight = FontWeight.Bold)
                        }
                        if (error != null) Text(error!!, color = Danger, fontSize = 10.sp)
                    }
                }
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(invites, key = { it.id }) { invite ->
                        GlassCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(invite.code, color = Ink, fontSize = 16.sp, letterSpacing = 1.sp, fontWeight = FontWeight.Medium)
                                    Spacer(Modifier.weight(1f))
                                    Text(
                                        if (invite.active) "可用 ${invite.remaining}/${invite.maxUses}" else if (invite.uses >= invite.maxUses) "已用完" else "不可用",
                                        color = if (invite.active) Cyan else Soft,
                                        fontSize = 9.sp,
                                    )
                                }
                                Text("${invite.expiresAt.take(10)} 到期 · 已用 ${invite.uses}/${invite.maxUses} 次", color = Soft, fontSize = 9.sp)
                                if (invite.usedBy.isNotEmpty()) Text("@" + invite.usedBy.joinToString(", @"), color = Soft, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    TextButton(onClick = {
                                        val text = "$siteOrigin/?invite=${invite.code}"
                                        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                                            .setPrimaryClip(ClipData.newPlainText("LUMEN invite", text))
                                        Toast.makeText(context, "邀请链接已复制", Toast.LENGTH_SHORT).show()
                                    }) { Text("复制链接", color = Cyan, fontSize = 10.sp) }
                                    if (invite.active) {
                                        TextButton(onClick = {
                                            scope.launch {
                                                try { Api.revokeInvite(invite.id); invites = invites.filter { it.id != invite.id }; onUpdated(invites) }
                                                catch (e: Exception) { error = e.message ?: "撤销失败" }
                                            }
                                        }) { Text("撤销", color = Danger, fontSize = 10.sp) }
                                    }
                                }
                            }
                        }
                    }
                    if (invites.isEmpty()) {
                        item { Text("还没有邀请码", color = Soft, fontSize = 11.sp, modifier = Modifier.padding(20.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminDialog(currentUsername: String, currentRole: String, onClose: () -> Unit) {
    var users by remember { mutableStateOf<List<AdminUser>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var deleteTarget by remember { mutableStateOf<AdminUser?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        loading = true; error = null
        scope.launch {
            try { users = Api.adminUsers() } catch (e: Exception) { error = e.message ?: "读取失败" }
            finally { loading = false }
        }
    }
    LaunchedEffect(Unit) { load() }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Bg)) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) { Icon(Icons.Outlined.ArrowBack, "返回", tint = Ink) }
                    Column {
                        Text("后台管理", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Light)
                        Text("${users.size} 个账号 · 当前 ${currentRole.uppercase()}", color = Soft, fontSize = 9.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = { load() }) { Icon(Icons.Outlined.Refresh, "刷新", tint = Cyan) }
                }
                if (error != null) Text(error!!, color = Danger, fontSize = 11.sp)
                if (loading) {
                    Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Cyan, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                    }
                }
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(users, key = { it.id }) { user ->
                        val self = user.username == currentUsername
                        val owner = user.role == "owner"
                        GlassCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(user.name, color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                        Text("@${user.username} · ${user.role.uppercase()}", color = if (user.role == "owner") Violet else Soft, fontSize = 8.sp)
                                    }
                                    if (user.disabled) Text("已禁用", color = Danger, fontSize = 9.sp)
                                }
                                Text("${user.photos} 影像 · ${user.people} 旅人", color = Soft, fontSize = 8.sp)
                                if (!self && !owner) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                        TextButton(onClick = {
                                            scope.launch {
                                                try {
                                                    Api.adminUpdateUser(user.id, role = if (user.role == "member") "admin" else "member")
                                                    load()
                                                } catch (e: Exception) { error = e.message ?: "操作失败" }
                                            }
                                        }) { Text(if (user.role == "member") "设为管理员" else "设为成员", color = Cyan, fontSize = 9.sp) }
                                        TextButton(onClick = {
                                            scope.launch {
                                                try { Api.adminUpdateUser(user.id, disabled = !user.disabled); load() }
                                                catch (e: Exception) { error = e.message ?: "操作失败" }
                                            }
                                        }) { Text(if (user.disabled) "启用" else "禁用", color = if (user.disabled) Cyan else Soft, fontSize = 9.sp) }
                                        TextButton(onClick = { deleteTarget = user }) { Text("删除", color = Danger, fontSize = 9.sp) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("删除账号") },
            text = { Text("删除 @${target.username} 及其照片、人物和邀请码？此操作不可恢复。") },
            confirmButton = {
                TextButton(onClick = {
                    deleteTarget = null
                    scope.launch {
                        try { Api.adminDeleteUser(target.id); load() }
                        catch (e: Exception) { error = e.message ?: "删除失败" }
                    }
                }) { Text("删除", color = Danger) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("取消") } },
        )
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
    val view = LocalView.current
    SideEffect {
        val window = (view.parent as? DialogWindowProvider)?.window ?: return@SideEffect
        window.setDimAmount(0.34f)
        window.addFlags(WindowManager.LayoutParams.FLAG_BLUR_BEHIND)
        if (Build.VERSION.SDK_INT >= 31) {
            window.attributes = window.attributes.apply { blurBehindRadius = 34 }
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            Modifier.fillMaxSize().background(Color(0x33000000)).navigationBarsPadding().padding(18.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.fillMaxWidth()
                    .shadow(28.dp, RoundedCornerShape(30.dp), clip = false)
                    .clip(RoundedCornerShape(30.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xE6152E42), Color(0xE6091522), Color(0xE60D1B2C)),
                        ),
                    )
                    .border(
                        1.dp,
                        Brush.linearGradient(
                            listOf(Color.White.copy(alpha = .38f), Cyan.copy(alpha = .25f), Violet.copy(alpha = .28f)),
                        ),
                        RoundedCornerShape(30.dp),
                    )
                    .padding(10.dp),
            ) {
                Box(
                    Modifier.fillMaxWidth().height(320.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(Color(0xFF02060E)),
                ) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current).data(photo.image).crossfade(true).build(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().blur(26.dp),
                    )
                    Box(Modifier.fillMaxSize().background(Color(0x99020811)))
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current).data(photo.image).crossfade(true).build(),
                        contentDescription = photo.title,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(
                        Modifier.fillMaxSize().background(
                            Brush.verticalGradient(
                                listOf(Color(0x88020811), Color.Transparent, Color.Transparent, Color(0xB3020811)),
                            ),
                        ),
                    )
                    Row(
                        Modifier.fillMaxWidth().padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("FLUID FRAME / 悬浮影像", color = Color.White.copy(alpha = .75f), fontSize = 8.sp, letterSpacing = 1.sp)
                        Spacer(Modifier.weight(1f))
                        IconButton(
                            onClick = onClose,
                            modifier = Modifier.size(32.dp).background(Color.Black.copy(alpha = .38f), CircleShape)
                                .border(1.dp, Color.White.copy(alpha = .18f), CircleShape),
                        ) {
                            Icon(Icons.Outlined.Close, "关闭", tint = Color.White, modifier = Modifier.size(17.dp))
                        }
                    }
                    Row(
                        Modifier.align(Alignment.BottomStart).padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        photo.tags.take(3).forEach { tag ->
                            Text(
                                "#$tag",
                                color = Cyan.copy(alpha = .9f),
                                fontSize = 8.sp,
                                modifier = Modifier.background(Color(0x99030A12), RoundedCornerShape(50))
                                    .padding(horizontal = 7.dp, vertical = 3.dp),
                            )
                        }
                    }
                }
                Column(Modifier.padding(horizontal = 9.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(photo.title, color = Ink, fontSize = 21.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Text(photo.capturedAt.take(10), color = Soft.copy(alpha = .85f), fontSize = 9.sp)
                    }
                    Text(photo.place, color = Cyan.copy(alpha = .85f), fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
