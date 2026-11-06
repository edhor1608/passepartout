# iOS app commands: `make -C ios <target>`. `make check` is the gate before a PR.
SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c
BUILD := $(CURDIR)/.build
DERIVED := $(BUILD)/DerivedData
SWIFT_SOURCES := PassepartoutKit/Package.swift PassepartoutKit/Sources PassepartoutKit/Tests Passepartout
APP := $(DERIVED)/Build/Products/Debug-iphonesimulator/Passepartout.app

.PHONY: project test test-ios build build-device lint format check run

project:
	xcodegen generate --spec project.yml --quiet

# Every kit test on the Mac host. Seconds; the inner loop.
test:
	swift test --package-path PassepartoutKit --scratch-path $(BUILD)/SwiftPM

# The same tests on the iOS simulator: ImageIO codecs and colour handling as shipped. Runs on the
# first iPhone simulator this Xcode can test on, or on SIM_ID=<udid>.
test-ios:
	cd PassepartoutKit && sim="$(SIM_ID)" \
	  && if [ -z "$$sim" ]; then sim=$$(xcodebuild -showdestinations -scheme PassepartoutKit 2>/dev/null \
	    | grep -m1 -E 'platform:iOS Simulator,.*name:iPhone' \
	    | grep -oE '[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}'); fi \
	  && if [ -z "$$sim" ]; then echo "error: no iPhone simulator; pass SIM_ID=<udid>" >&2; exit 1; fi \
	  && echo "simulator $$sim" \
	  && xcodebuild test -scheme PassepartoutKit \
	    -destination "platform=iOS Simulator,id=$$sim" -derivedDataPath $(DERIVED) \
	    2>&1 | grep -E 'error:|✘|Test run with|\*\* TEST'

# Unsigned simulator build of the app.
build: project
	xcodebuild build -project Passepartout.xcodeproj -scheme Passepartout -quiet \
	  -destination 'generic/platform=iOS Simulator' -derivedDataPath $(DERIVED) \
	  CODE_SIGNING_ALLOWED=NO

# Signed build for a real iPhone: automatic signing with the team in project.yml.
build-device: project
	xcodebuild build -project Passepartout.xcodeproj -scheme Passepartout -quiet \
	  -destination 'generic/platform=iOS' -derivedDataPath $(DERIVED) -allowProvisioningUpdates

lint:
	xcrun swift-format lint --strict --recursive --parallel $(SWIFT_SOURCES)

format:
	xcrun swift-format format --in-place --recursive --parallel $(SWIFT_SOURCES)

check: lint test test-ios build

# Install and launch on the booted simulator.
run: build
	xcrun simctl install booted $(APP)
	xcrun simctl launch booted me.edhor.passepartout
