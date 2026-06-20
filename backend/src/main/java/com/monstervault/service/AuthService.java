package com.monstervault.service;

import java.util.Optional;

public interface AuthService {

    Optional<AuthResponse> authenticate(String username, String password);

    Optional<AuthResponse> refresh(String refreshToken);

    void logout(String refreshToken);
}
