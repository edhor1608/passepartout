function version(text, parts) { split(text, parts, "."); return parts[1] * 100 + parts[2] }
/^-- iOS / { runtime = version($3); next }
/^-- / { runtime = 0; next }
runtime >= version("26.0") && runtime <= version(sdk) && $1 == "iPhone" \
  && match($0, /[0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+/) {
  id = substr($0, RSTART, RLENGTH)
  if ($0 ~ /\(Booted\)/ && booted == "") booted = id
  if (runtime > newest) { newest = runtime; newestID = id }
}
END { print (booted != "" ? booted : newestID) }
