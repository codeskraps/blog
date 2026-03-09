+++
title = 'Umami Analytics for Mobile Apps Without a WebView'
date = 2026-03-09T12:00:00+01:00
tags = ['android', 'kotlin', 'analytics', 'umami', 'open-source']
draft = false
+++

Umami is a great privacy-focused, self-hosted alternative to Google Analytics. But its documentation assumes you're tracking a website. If you want to use it in a mobile app, the docs point you toward embedding a WebView — which is clunky, adds overhead, and feels wrong for native apps. There's a better way: hit the Umami API directly.

<!--more-->

## The Problem

Umami's tracking script works by injecting JavaScript into web pages. The "official" mobile approach is loading that script in a hidden WebView. This means bundling a browser engine just to send analytics events, dealing with WebView lifecycle quirks, and hoping the JavaScript executes reliably in the background.

For a native Android app, you already have HTTP clients and coroutines. You don't need a WebView to send a POST request.

## The Umami Send API

Umami exposes a `/api/send` endpoint that accepts event data directly. No authentication token is required — but you **must** send a valid `User-Agent` header or your request will be silently ignored.

The endpoint accepts a JSON body with two top-level fields:

```json
{
  "type": "event",
  "payload": {
    "website": "your-website-id",
    "url": "/screen-name",
    "title": "Screen Name",
    "name": "event_name",
    "data": { "key": "value" }
  }
}
```

The `type` field is always `"event"`. The `payload` fields vary depending on what you're tracking — page views use `url` and `title`, custom events use `name` and optionally `data`.

## Setting Up the Module

I structured the analytics as a standalone module in [Weekly Weather](https://play.google.com/store/apps/details?id=com.codeskraps.weather) using clean architecture — a domain interface, a data source that handles the HTTP calls, and a repository that wires it together.

### The Domain Interface

Keep it simple. The rest of the app only sees this:

```kotlin
interface AnalyticsRepository {
    suspend fun initialize()
    suspend fun trackPageView(pageName: String)
    suspend fun trackEvent(
        eventName: String,
        eventData: Map<String, String> = emptyMap()
    )
    suspend fun identifyUser(userId: String?)
}
```

### The Data Source

This is where the actual API calls happen. No Retrofit, no Ktor — just `HttpURLConnection`:

```kotlin
internal data class UmamiConfig(
    val websiteId: String,
    val baseUrl: String
)

internal class UmamiAnalyticsDataSource(
    private val context: Context,
    private val config: UmamiConfig
) {
    private var isInitialized = false
    private val userAgent: String by lazy { buildUserAgent() }

    suspend fun initialize() {
        isInitialized = true
    }

    suspend fun trackPageView(pageName: String) {
        if (!isInitialized) return

        val url = if (pageName.startsWith("/")) pageName
                  else "/$pageName"
        val title = pageName
            .replace("-", " ")
            .replaceFirstChar { it.uppercase() }

        val payload = JSONObject().apply {
            put("website", config.websiteId)
            put("url", url)
            put("title", title)
        }
        sendEvent("event", payload)
    }

    suspend fun trackEvent(
        eventName: String,
        eventData: Map<String, String> = emptyMap()
    ) {
        if (!isInitialized) return

        val payload = JSONObject().apply {
            put("website", config.websiteId)
            put("name", eventName)
            if (eventData.isNotEmpty()) {
                put("data", JSONObject(eventData as Map<*, *>))
            }
        }
        sendEvent("event", payload)
    }

    private suspend fun sendEvent(
        type: String,
        payload: JSONObject
    ) = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("type", type)
                put("payload", payload)
            }

            val connection = URL("${config.baseUrl}/api/send")
                .openConnection() as HttpURLConnection
            connection.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("User-Agent", userAgent)
                connectTimeout = 5000
                readTimeout = 5000
                doOutput = true
            }

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(body.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            connection.disconnect()

            if (responseCode !in 200..299) {
                Log.w(TAG, "Umami API returned $responseCode for $type")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send $type event", e)
        }
    }

    private fun buildUserAgent(): String {
        val appVersion = try {
            val packageInfo = context.packageManager
                .getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
        return "MyApp/$appVersion (Android ${Build.VERSION.RELEASE}; " +
               "${Build.MODEL}; ${Locale.getDefault().language})"
    }

    companion object {
        private const val TAG = "UmamiAnalytics"
    }
}
```

A few things worth noting:

- **User-Agent is mandatory.** Umami silently drops requests without one. Building a descriptive agent string also gives you useful device info in your dashboard.
- **No third-party HTTP library needed.** `HttpURLConnection` works fine for fire-and-forget analytics. No need to pull in Retrofit or Ktor just for this.
- **`Dispatchers.IO`** keeps network calls off the main thread.
- **5-second timeouts** prevent analytics from blocking your app if the server is slow.
- **Failures are non-fatal.** Log a warning and move on — analytics should never crash your app.

### The User-Agent Gotcha

This is the thing that will trip you up. Umami's docs mention it in passing, but it's easy to miss: if you don't send a `User-Agent` header, your events will be accepted (you'll get a 200 response) but **silently discarded**. They won't show up in your dashboard. No error, no warning. The request just vanishes.

Build a descriptive user agent string with your app name, version, OS, and device model. This also shows up in your Umami dashboard as the "browser" field, which gives you a quick view of which devices and app versions your users are on.

## Device Identification

For session tracking without relying on cookies (which don't exist in a native app), generate a UUID on first launch and persist it:

```kotlin
class DeviceIdRepositoryImpl(
    private val application: Application
) : DeviceIdRepository {

    private val prefs: SharedPreferences = application
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun getOrCreateDeviceId(): String {
        return prefs.getString(KEY_DEVICE_ID, null)
            ?: generateAndSaveDeviceId()
    }

    private fun generateAndSaveDeviceId(): String {
        val deviceId = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        return deviceId
    }

    companion object {
        private const val PREFS_NAME = "app_device_prefs"
        private const val KEY_DEVICE_ID = "device_id"
    }
}
```

The repository initializes analytics and immediately identifies the device:

```kotlin
internal class AnalyticsRepositoryImpl(
    private val application: Application,
    private val deviceIdRepository: DeviceIdRepository
) : AnalyticsRepository {
    private val analyticsDataSource = UmamiAnalyticsDataSource(
        context = application,
        config = UmamiConfig(
            websiteId = "your-website-id-here",
            baseUrl = "https://your-umami-instance.com"
        )
    )

    override suspend fun initialize() {
        analyticsDataSource.initialize()
        val deviceId = deviceIdRepository.getOrCreateDeviceId()
        identifyUser(deviceId)
    }

    // ... delegate other calls to analyticsDataSource
}
```

## Dependency Injection

Wire it up with Koin (or whichever DI framework you use):

```kotlin
val umamiModule = module {
    single<DeviceIdRepository> {
        DeviceIdRepositoryImpl(androidApplication())
    }
    single<AnalyticsRepository> {
        AnalyticsRepositoryImpl(androidApplication(), get())
    }
}
```

## Using It in Your App

Initialize in your `MainActivity`:

```kotlin
class MainActivity : ComponentActivity() {
    private val analyticsRepository: AnalyticsRepository by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            analyticsRepository.initialize()
        }
    }
}
```

Then track events from your ViewModels:

```kotlin
class WeatherViewModel(
    private val analyticsRepository: AnalyticsRepository
) : ViewModel() {

    fun onScreenVisible() {
        viewModelScope.launch {
            analyticsRepository.trackPageView("weather")
        }
    }

    fun onLocationLoaded(location: String) {
        viewModelScope.launch {
            analyticsRepository.trackEvent(
                "weather_load",
                mapOf("location" to location)
            )
        }
    }

    fun onError(message: String) {
        viewModelScope.launch {
            analyticsRepository.trackEvent(
                "weather_error",
                mapOf("error_message" to message)
            )
        }
    }
}
```

Page views map to screens in Umami's dashboard as if they were web pages — `/weather`, `/settings`, `/map`. Custom events show up in the events tab with their associated data.

## Umami Dashboard Setup

On the Umami side, there's nothing special to configure. Create a new website in your Umami dashboard and grab the website ID. The same `/api/send` endpoint handles both web and API-sourced events. Your mobile events will appear alongside web traffic if you use the same website ID, or you can create a separate website entry to keep them isolated.

## Why Not Just Use Firebase?

Firebase Analytics works well, but it comes with Google's data collection policies, requires Google Play Services, and its dashboard is designed around Google's advertising ecosystem. If you're already self-hosting Umami for your website and want a unified, privacy-respecting analytics view across web and mobile, this approach gets you there with minimal code and zero additional dependencies.

The entire implementation is about 120 lines of Kotlin with no third-party libraries beyond what Android provides out of the box.
