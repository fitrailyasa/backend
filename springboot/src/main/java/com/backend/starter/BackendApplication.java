package com.backend.starter;

import com.backend.starter.common.DotenvLoader;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class BackendApplication {

    public static void main(String[] args) {
        DotenvLoader.load();
        SpringApplication.run(BackendApplication.class, args);
    }
}
