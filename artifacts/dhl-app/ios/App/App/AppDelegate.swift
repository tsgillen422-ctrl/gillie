import UIKit
import Capacitor
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Forward the APNs device token to Capacitor's PushNotifications plugin.
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Forward the registration failure to Capacitor's PushNotifications plugin.
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - Native "Sign in with Apple" Capacitor plugin
//
// This is a self-contained Capacitor plugin built directly on Apple's
// AuthenticationServices (ASAuthorizationAppleIDProvider). We deliberately do
// NOT use @capacitor-community/apple-sign-in: its iOS Package.swift pins
// capacitor-swift-pm to >=7 <8, which conflicts with @capacitor/push-notifications@8
// (requires capacitor-swift-pm >=8), breaking SwiftPM resolution at build time.
//
// It lives inside AppDelegate.swift (already part of the App target's compile
// sources) so it is guaranteed to be built into the binary without editing the
// Xcode project file. Capacitor auto-registers any CAPBridgedPlugin-conforming
// class, so the JS side reaches it via registerPlugin("AppleNativeSignIn").
//
// The webview calls authorize(); on success we return the JWT identity token
// (verified server-side against Apple's public JWKS) plus the name/email Apple
// provides on the first authorization only.
@objc(AppleNativeSignInPlugin)
public class AppleNativeSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleNativeSignInPlugin"
    public let jsName = "AppleNativeSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pendingCall = call
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }
}

extension AppleNativeSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = self.pendingCall else { return }
        self.pendingCall = nil

        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let identityToken = String(data: tokenData, encoding: .utf8)
        else {
            call.reject("Apple did not return an identity token")
            return
        }

        let given = credential.fullName?.givenName
        let family = credential.fullName?.familyName
        let fullName = [given, family].compactMap { $0 }.joined(separator: " ")

        // Apple also returns a short-lived authorization code (Data). We surface
        // its presence for debugging the native handoff; the backend verifies the
        // identityToken, so the code is informational only.
        let authorizationCode: String? = credential.authorizationCode
            .flatMap { String(data: $0, encoding: .utf8) }

        var result: [String: Any] = ["identityToken": identityToken]
        result["email"] = credential.email ?? NSNull()
        result["fullName"] = fullName.isEmpty ? NSNull() : fullName
        result["authorizationCode"] = authorizationCode ?? NSNull()
        call.resolve(result)
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        guard let call = self.pendingCall else { return }
        self.pendingCall = nil

        // ASAuthorizationError.canceled (1001) is the user dismissing the sheet —
        // surfaced with a distinct message the JS layer treats as a quiet cancel.
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("cancelled", "1001")
            return
        }
        call.reject(error.localizedDescription)
    }
}

extension AppleNativeSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = self.bridge?.viewController?.view.window {
            return window
        }
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene {
                if let key = windowScene.windows.first(where: { $0.isKeyWindow }) ?? windowScene.windows.first {
                    return key
                }
            }
        }
        return ASPresentationAnchor()
    }
}
