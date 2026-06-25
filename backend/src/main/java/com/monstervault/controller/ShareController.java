package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.service.CanService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class ShareController {

    private final CanService canService;

    public ShareController(CanService canService) {
        this.canService = canService;
    }

    @GetMapping(value = "/share/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String share(@PathVariable String id) {
        Can can;
        try { can = canService.getById(id); } catch (Exception e) { can = null; }
        if (can == null) {
            return redirect("/");
        }
        String title = esc(can.getNome() != null ? can.getNome() : "Monster Can");
        String desc = esc(can.getDescrizione() != null ? can.getDescrizione() : "Monster Energy can collection");
        String image = can.getP1() != null
                ? can.getP1().replace("/image/upload/", "/image/upload/c_fill,w_1200,h_630,g_auto/")
                : "https://monster-vault-server.onrender.com/social-preview.png";
        String appUrl = "/?public=1&can=" + id;

        return "<!DOCTYPE html><html><head>"
                + "<meta property=\"og:title\" content=\"" + title + " — Monster Vault\"/>"
                + "<meta property=\"og:description\" content=\"" + desc + "\"/>"
                + "<meta property=\"og:image\" content=\"" + esc(image) + "\"/>"
                + "<meta property=\"og:url\" content=\"https://monster-vault-server.onrender.com/share/" + id + "\"/>"
                + "<meta property=\"og:image:width\" content=\"1200\"/>"
                + "<meta property=\"og:image:height\" content=\"630\"/>"
                + "<meta property=\"og:image:alt\" content=\"" + title + "\"/>"
                + "<meta property=\"og:type\" content=\"website\"/>"
                + "<meta name=\"twitter:card\" content=\"summary_large_image\"/>"
                + "<meta http-equiv=\"refresh\" content=\"0;url=" + appUrl + "\"/>"
                + "</head><body><a href=\"" + appUrl + "\">View in Monster Vault</a></body></html>";
    }

    private static String redirect(String url) {
        return "<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0;url=" + url + "\"/></head><body></body></html>";
    }

    // ponytail: minimal HTML escaping, good enough for OG meta values
    private static String esc(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
