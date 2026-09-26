import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Фон WebView до первой отрисовки страницы — цвет страницы по теме ОС, а не
// белый systemBackground Capacitor: между сплэшем и первым кадром WebKit (ждёт
// render-blocking CSS шрифтов и «визуально непустой» страницы) иначе мелькает
// белый экран. Цвета — --page из src/index.css: светлая #f4f3ef, тёмная #16150f.
class MainViewController: CAPBridgeViewController {
    private static let pageBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x16 / 255, green: 0x15 / 255, blue: 0x0F / 255, alpha: 1)
            : UIColor(red: 0xF4 / 255, green: 0xF3 / 255, blue: 0xEF / 255, alpha: 1)
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.isOpaque = false
        webView?.backgroundColor = Self.pageBackground
        webView?.scrollView.backgroundColor = Self.pageBackground
    }
}
