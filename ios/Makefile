# iOS app commands: `make -C ios <target>`. `make check` is the gate before a PR.
SIM ?= iPhone 17 Pro
SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c
BUILD := $(CURDIR)/.build
DERIVED := $(BUILD)/DerivedData
SWIFT_SOURCES := PassepartoutKit/Package.swift PassepartoutKit/Sources PassepartoutKit/Tests

.PHONY: test test-ios lint format check

# Every kit test on the Mac host. Seconds; the inner loop.
test:
	swift test --package-path PassepartoutKit --scratch-path $(BUILD)/SwiftPM

# The same tests on the iOS simulator: ImageIO codecs and colour handling as shipped.
test-ios:
	cd PassepartoutKit && xcodebuild test -scheme PassepartoutKit \
	  -destination 'platform=iOS Simulator,name=$(SIM)' -derivedDataPath $(DERIVED) \
	  2>&1 | grep -E 'error:|✘|Test run with|\*\* TEST'

lint:
	xcrun swift-format lint --strict --recursive --parallel $(SWIFT_SOURCES)

format:
	xcrun swift-format format --in-place --recursive --parallel $(SWIFT_SOURCES)

check: lint test test-ios
