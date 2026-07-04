package com.monstervault.config;

import com.monstervault.security.LoginRateLimitInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configurazione MVC: registra gli interceptor.
 *
 * LoginRateLimitInterceptor viene applicato solo a /api/auth/login
 * per non impattare le performance degli altri endpoint.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final LoginRateLimitInterceptor rateLimitInterceptor;

    public WebConfig(LoginRateLimitInterceptor rateLimitInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/auth/login", "/api/auth/recover");
    }
}
