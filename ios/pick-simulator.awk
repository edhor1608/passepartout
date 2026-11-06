# Reads `xcrun simctl list devices available` and prints the UDID of a booted iPhone simulator,
# else of the first iPhone on the newest iOS runtime up to `sdk`, the SDK version of this Xcode.
# Prints an empty line when there is none. Used by `make test-ios`.
function version(text, parts) { split(text, parts, "."); return parts[1] * 100 + parts[2] }
/^-- iOS / { runtime = version($3); next }
/^-- / { runtime = 0; next }
runtime > 0 && runtime <= version(sdk) && $1 == "iPhone" \
  && match($0, /[0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+/) {
  id = substr($0, RSTART, RLENGTH)
  if ($0 ~ /\(Booted\)/ && booted == "") booted = id
  if (runtime > newest) { newest = runtime; newestID = id }
}
END { print (booted != "" ? booted : newestID) }
