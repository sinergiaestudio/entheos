# Keep the JSON payload model names stable while allowing the rest of the release
# build to be optimized and obfuscated.
-keepattributes Signature
-dontwarn org.conscrypt.**
