plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseKeystorePath = providers.environmentVariable("ENTHEOS_UPLOAD_KEYSTORE").orNull
val releaseStorePassword = providers.environmentVariable("ENTHEOS_UPLOAD_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ENTHEOS_UPLOAD_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ENTHEOS_UPLOAD_KEY_PASSWORD").orNull
val releaseSigningReady = listOf(
    releaseKeystorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "app.entheos.salud"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.entheos.salud"
        minSdk = 28
        targetSdk = 36
        versionCode = 4
        versionName = "1.0.3"
        buildConfigField(
            "String",
            "ENTHEOS_BASE_URL",
            "\"https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site\"",
        )
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(requireNotNull(releaseKeystorePath))
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        checkTestSources = false
        ignoreTestSources = true
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.collection:collection:1.4.2")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.1")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
