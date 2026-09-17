// Native WebKit viewport audit. No credentials, cookies or browser profiles are read.
// Usage: swift scripts/mobile-audit.swift URL OUTPUT_PREFIX WIDTH HEIGHT
import AppKit
import WebKit

@MainActor final class MobileAudit: NSObject, WKNavigationDelegate {
    let web: WKWebView
    let window: NSWindow
    let output: String
    var finished = false
    init(url: URL, output: String, width: Double, height: Double) {
        self.output = output
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height), configuration: config)
        window = NSWindow(contentRect: web.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        super.init()
        window.contentView = web
        window.setFrameOrigin(NSPoint(x: 30, y: 30))
        window.orderFront(nil)
        web.navigationDelegate = self
        web.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        web.load(URLRequest(url: url))
        DispatchQueue.main.asyncAfter(deadline: .now() + 40) { [self] in
            if !finished { fail("Timeout waiting for navigation/snapshot") }
        }
    }
    func fail(_ message: String) { fputs(message + "\n", stderr); exit(1) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [self] in capture() }
    }
    func capture() {
        let js = #"""
        (() => {
          const visible = el => {const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'};
          const nav=performance.getEntriesByType('navigation')[0];
          return JSON.stringify({
            url: location.href, title:document.title, viewport:{width:innerWidth,height:innerHeight},
            horizontalOverflow: document.documentElement.scrollWidth>innerWidth,
            overflowingElements:[...document.querySelectorAll('body *')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&getComputedStyle(el).position!=='fixed'}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width})),
            smallTargets:[...document.querySelectorAll('button,select,input,a')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight&&(r.height<44||r.width<44)}).map(el=>({text:el.textContent.trim().slice(0,65),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width})),
            images:[...document.images].map(i=>({src:i.getAttribute('src'),lazy:i.loading,width:i.naturalWidth,height:i.naturalHeight,loaded:i.complete})),
            navigation: nav?{responseMs:Math.round(nav.responseEnd-nav.startTime),domReadyMs:Math.round(nav.domContentLoadedEventEnd-nav.startTime),loadMs:Math.round(nav.loadEventEnd-nav.startTime),transferBytes:nav.transferSize}:null,
            resources:performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.transferSize,durationMs:Math.round(r.duration)})),
            linkedWeek:location.hash.startsWith('#week-')?document.querySelector(location.hash+' .week-header')?.getAttribute('aria-expanded'):null
          },null,2)
        })()
        """#
        web.evaluateJavaScript(js) { [self] result, error in
            if let error { fail(error.localizedDescription) }
            guard let report = result as? String else { fail("No DOM audit report"); return }
            do { try report.write(toFile: output + ".json", atomically: true, encoding: .utf8) } catch { fail(error.localizedDescription) }
            let snapshot = WKSnapshotConfiguration()
            snapshot.rect = web.bounds
            web.takeSnapshot(with: snapshot) { [self] image, error in
                if let error { fail(error.localizedDescription) }
                guard let tiff=image?.tiffRepresentation, let bitmap=NSBitmapImageRep(data:tiff), let png=bitmap.representation(using:.png,properties:[:]) else { fail("No snapshot image"); return }
                do { try png.write(to:URL(fileURLWithPath:output+".png")) } catch { fail(error.localizedDescription) }
                print(report)
                finished = true
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
let args=CommandLine.arguments
guard args.count==5, let url=URL(string:args[1]), let width=Double(args[3]),let height=Double(args[4]) else { fputs("Usage: swift scripts/mobile-audit.swift URL OUTPUT_PREFIX WIDTH HEIGHT\n",stderr);exit(1) }
let app=NSApplication.shared
app.setActivationPolicy(.accessory)
MainActor.assumeIsolated {
    let audit=MobileAudit(url:url,output:args[2],width:width,height:height)
    withExtendedLifetime(audit) { app.run() }
}
