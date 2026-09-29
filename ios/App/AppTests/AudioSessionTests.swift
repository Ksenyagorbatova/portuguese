import AVFAudio
import UIKit
import WebKit
import XCTest

// Runs inside the real app after AppDelegate/Capacitor startup. A JS mock cannot
// reproduce the Ring/Silent switch or inspect the session used by Web Speech.
final class AudioSessionTests: XCTestCase {
    @MainActor
    func testLaunchAllowsSpeechInSilentModeWithoutInterruptingOtherAudio() {
        let session = AVAudioSession.sharedInstance()
        XCTAssertEqual(session.category, .playback)
        XCTAssertTrue(session.categoryOptions.contains(.mixWithOthers))
    }

    @MainActor
    func testWebSpeechKeepsThePlaybackSession() async throws {
        // Some CI simulator images have no speech voices installed. The launch
        // test above always runs; only the real synthesis check needs a voice.
        guard !AVSpeechSynthesisVoice.speechVoices().isEmpty else {
            throw XCTSkip("The simulator has no speech voices installed")
        }
        let started = expectation(description: "Web Speech started")
        let handler = SpeechStartedHandler(started: started)
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(handler, name: "speechTest")
        let webView = WKWebView(frame: .zero, configuration: config)
        defer {
            config.userContentController.removeScriptMessageHandler(forName: "speechTest")
            webView.evaluateJavaScript("speechSynthesis.cancel()")
        }
        webView.loadHTMLString("""
            <!doctype html><script>
            const utterance = new SpeechSynthesisUtterance('Olá');
            utterance.lang = 'pt-PT';
            utterance.onstart = () => window.webkit.messageHandlers.speechTest.postMessage('start');
            utterance.onerror = event => window.webkit.messageHandlers.speechTest.postMessage(event.error);
            speechSynthesis.speak(utterance);
            </script>
            """, baseURL: nil)
        await fulfillment(of: [started], timeout: 15)
        XCTAssertEqual(handler.event, "start", "Web Speech failed to start")
        let session = AVAudioSession.sharedInstance()
        XCTAssertEqual(session.category, .playback, "Web Speech must retain the silent-mode policy")
        XCTAssertTrue(session.categoryOptions.contains(.mixWithOthers))
    }
}

private final class SpeechStartedHandler: NSObject, WKScriptMessageHandler {
    let started: XCTestExpectation
    var event: String?

    init(started: XCTestExpectation) {
        self.started = started
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard event == nil else { return }
        event = message.body as? String
        started.fulfill()
    }
}
