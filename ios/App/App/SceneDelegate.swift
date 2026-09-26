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
// белый экран. На время первой загрузки Capacitor сам делает WebView
// прозрачным (WebViewDelegationHandler.willLoadWebview) и потом возвращает
// непрозрачность — сквозь него виден этот фон. PageBackground — --page из
// src/index.css (светлый/тёмный), генерирует `npm run ios:assets`.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        let page = UIColor(named: "PageBackground") ?? .systemBackground
        webView?.backgroundColor = page
        webView?.scrollView.backgroundColor = page
    }
}
