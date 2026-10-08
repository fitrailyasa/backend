package com.backend.starter.user.controller;

import com.backend.starter.common.ApiResponse;
import com.backend.starter.common.PageQuery;
import com.backend.starter.security.CurrentUser;
import com.backend.starter.user.dto.UserDtos.UserResponse;
import com.backend.starter.user.dto.UserDtos.UserWriteRequest;
import com.backend.starter.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        return ApiResponse.ok("User retrieved", userService.get(CurrentUser.require().getId()));
    }

    @PatchMapping("/me")
    public ApiResponse<UserResponse> updateMe(@RequestBody UserWriteRequest request) {
        return ApiResponse.ok("Profile updated successfully", userService.patchProfile(CurrentUser.require().getId(), request));
    }

    @GetMapping
    public ApiResponse<List<UserResponse>> index(HttpServletRequest request) {
        UserService.PageResult result = userService.list(PageQuery.fromRequest(request));
        return ApiResponse.page("Users retrieved", result.rows(), result.meta());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> store(@RequestBody UserWriteRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok("User created successfully", userService.create(request)));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> show(@PathVariable String id) {
        return ApiResponse.ok("User retrieved", userService.get(PageQuery.requiredPathId("id", id)));
    }

    @PutMapping("/{id}")
    public ApiResponse<UserResponse> replace(@PathVariable String id, @RequestBody UserWriteRequest request) {
        return ApiResponse.ok("User updated successfully", userService.replace(PageQuery.requiredPathId("id", id), request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<UserResponse> update(@PathVariable String id, @RequestBody UserWriteRequest request) {
        return ApiResponse.ok("User updated successfully", userService.patch(PageQuery.requiredPathId("id", id), request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        userService.delete(PageQuery.requiredPathId("id", id));
        return ApiResponse.ok("User deleted successfully", null);
    }
}
