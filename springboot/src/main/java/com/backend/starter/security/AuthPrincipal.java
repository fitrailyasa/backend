package com.backend.starter.security;

import com.backend.starter.user.entity.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class AuthPrincipal implements UserDetails {

    private final Long id;
    private final String email;
    private final Role role;
    private final String jti;
    private final long expiresAtEpochSecond;

    public AuthPrincipal(Long id, String email, Role role, String jti, long expiresAtEpochSecond) {
        this.id = id;
        this.email = email;
        this.role = role;
        this.jti = jti;
        this.expiresAtEpochSecond = expiresAtEpochSecond;
    }

    public Long getId() {
        return id;
    }

    public Role getRole() {
        return role;
    }

    public String getJti() {
        return jti;
    }

    public long getExpiresAtEpochSecond() {
        return expiresAtEpochSecond;
    }

    public boolean isAdmin() {
        return role == Role.admin;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name().toUpperCase()));
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
