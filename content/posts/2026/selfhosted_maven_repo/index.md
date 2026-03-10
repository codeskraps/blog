+++
title = 'Using a Self-Hosted Git Repository as a Maven Repository'
date = 2026-03-10T10:00:00+01:00
tags = ['android', 'kotlin', 'gradle', 'maven', 'self-hosted', 'open-source']
draft = false
+++

If you maintain shared libraries across multiple Android or Kotlin Multiplatform projects, you've probably considered publishing them to a Maven repository. Maven Central works, but the publishing process is heavy — GPG signing, Sonatype staging, approval delays. For private or small-scale libraries, that's overkill. If you already self-host a Git server like [Gitea](https://about.gitea.com/) or [Gogs](https://gogs.io/), you can use it as a Maven repository with zero additional infrastructure.

<!--more-->

## How It Works

A Maven repository is just a directory structure served over HTTP. When Gradle resolves a dependency like `com.example:mylib:1.0.0`, it looks for files at a predictable path:

```
com/example/mylib/1.0.0/mylib-1.0.0.aar
com/example/mylib/1.0.0/mylib-1.0.0.pom
com/example/mylib/1.0.0/mylib-1.0.0.module
```

Git hosting platforms like Gitea and Gogs can serve raw file content from a repository via URL. If you push those Maven artifacts into a Git repo, the raw file URLs become a perfectly valid Maven repository endpoint. No Nexus, no Artifactory, no S3 bucket.

## Setting Up the Maven Repository

Create a Git repository on your server. I use Gogs, so my repo lives at `git.codeskraps.com/codeskraps/MavenRepo`. Clone it locally:

```bash
git clone git@git.codeskraps.com:codeskraps/MavenRepo.git ~/maven-repo
```

That's your Maven repository. Artifacts will be committed and pushed here.

## Configuring Your Library to Publish

I'll use [UmamiLib](https://git.codeskraps.com/codeskraps/UmamiLIb) as an example — a Kotlin Multiplatform analytics library that I publish this way. The same approach works for plain Android libraries.

In your library's `build.gradle.kts`, add the `maven-publish` plugin and configure a local repository output directory:

```kotlin
plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidKmpLibrary)
    id("maven-publish")
}

group = "com.codeskraps.umamilib"
version = "0.4.0"

kotlin {
    android {
        namespace = "com.codeskraps.umamilib"
        compileSdk = 36
        minSdk = 24
    }

    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            // your dependencies
        }
    }
}

publishing {
    repositories {
        maven {
            name = "local"
            url = uri(layout.buildDirectory.dir("maven-repo"))
        }
    }
}
```

The key part is the `publishing` block. Instead of publishing directly to a remote server, we publish to a local directory inside the build folder. This gives us the complete Maven directory structure that we'll then commit to our Git-based repository.

For a standard Android library (non-KMP), the setup is similar but uses the `android.library` plugin and requires explicit publishing configuration:

```kotlin
plugins {
    alias(libs.plugins.android.library)
    id("maven-publish")
}

group = "com.example.mylib"
version = "1.0.0"

android {
    // ...
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                groupId = "com.example.mylib"
                artifactId = "mylib"
                version = project.version.toString()
            }
        }
        repositories {
            maven {
                name = "local"
                url = uri(layout.buildDirectory.dir("maven-repo"))
            }
        }
    }
}
```

## The Publish Script

A simple shell script handles the build-copy-push cycle:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_REPO_DIR="$HOME/maven-repo"

echo "==> Building and publishing..."
cd "$SCRIPT_DIR"
./gradlew :umamilib:publish

echo "==> Copying artifacts to maven-repo..."
mkdir -p "$MAVEN_REPO_DIR"
cp -r "$SCRIPT_DIR/umamilib/build/maven-repo/"* "$MAVEN_REPO_DIR/"

echo "==> Publishing to mavenLocal for immediate use..."
./gradlew :umamilib:publishToMavenLocal

echo "==> Pushing to Git..."
cd "$MAVEN_REPO_DIR"
git add -A
git commit -m "Publish umamilib $(grep '^version' \
    "$SCRIPT_DIR/umamilib/build.gradle.kts" | head -1 | \
    sed 's/.*"\(.*\)".*/\1/')"
git push

echo "==> Done!"
```

This does three things:

1. **`./gradlew :umamilib:publish`** — Builds the library and writes artifacts to `build/maven-repo/`
2. **Copies to the Git-backed Maven repo** — The directory structure is ready to serve
3. **`publishToMavenLocal`** — Also publishes to `~/.m2` so local projects can resolve it immediately without waiting for the Git push

After the push, the artifacts are available at the raw file URL.

## Consuming the Library

On the consumer side, add the raw file URL as a Maven repository in `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://git.codeskraps.com/codeskraps/MavenRepo/raw/main")
        }
    }
}
```

The `/raw/main` path tells Gogs (or Gitea) to serve the file contents directly from the `main` branch — exactly what Gradle needs.

Then add the dependency as you would any other:

```kotlin
implementation("com.codeskraps.umamilib:umamilib:0.4.0")
```

Or with a version catalog:

```toml
[versions]
umamilib = "0.4.0"

[libraries]
umamilib = { module = "com.codeskraps.umamilib:umamilib", version.ref = "umamilib" }
```

Gradle resolves the `.module` file from the raw URL, finds the platform-specific artifact (AAR for Android, klib for iOS), downloads it, and you're done. No difference from using Maven Central, just a different repository URL.

## Multiple Libraries, One Repository

The Maven directory structure naturally supports multiple libraries in the same repository. Each library gets its own path under the group ID:

```
com/codeskraps/chartlib/chartlib/0.1.0/...
com/codeskraps/umamilib/umamilib/0.4.0/...
com/codeskraps/umamilib/umamilib-android/0.4.0/...
com/codeskraps/umamilib/umamilib-iosarm64/0.4.0/...
```

Each library has its own `publish.sh` that copies into the same shared repository directory. One Git repo, one URL, multiple artifacts.

## KMP Considerations

For Kotlin Multiplatform libraries, the `maven-publish` plugin automatically creates separate publications for each target. A KMP library with Android and iOS targets publishes:

- `umamilib` — The metadata module (Gradle uses this to resolve the correct platform artifact)
- `umamilib-android` — The Android AAR
- `umamilib-iosarm64` — The iOS arm64 klib
- `umamilib-iossimulatorarm64` — The iOS simulator klib

Consumers just depend on the base module (`com.codeskraps.umamilib:umamilib:0.4.0`), and Gradle's metadata resolution picks the right artifact for the platform.

## Versioning and Old Versions

Since it's a Git repository, every version you publish stays in the history. You can host multiple versions simultaneously — Gradle will resolve whichever version the consumer specifies. If you need to remove an old version, just delete the directory and push.

## Trade-offs

This approach has some clear advantages:

- **Zero infrastructure** beyond what you already have — if you self-host Git, you're done
- **No account setup**, no API keys, no staging/release workflows
- **Full control** over your artifacts and availability
- **Works offline** with `mavenLocal` during development

But it's not for everything:

- **No authentication** on the consumer side — anyone with the URL can resolve your artifacts (fine for public libraries, not ideal for proprietary ones)
- **Git repo size grows** with each published version — binary artifacts (AARs, JARs) add up. For small libraries this is negligible; for large ones, consider periodic cleanup or Git LFS
- **No search or discovery** — consumers need to know the URL and coordinates

For personal libraries, small teams, or open-source projects where Maven Central's process feels disproportionate, this is a pragmatic solution that takes about ten minutes to set up.

## Links

- [UmamiLib](https://git.codeskraps.com/codeskraps/UmamiLIb) — The KMP analytics library used as an example
- [MavenRepo](https://git.codeskraps.com/codeskraps/MavenRepo) — The Git-backed Maven repository
- [Gogs](https://gogs.io/) / [Gitea](https://about.gitea.com/) — Self-hosted Git platforms with raw file serving
