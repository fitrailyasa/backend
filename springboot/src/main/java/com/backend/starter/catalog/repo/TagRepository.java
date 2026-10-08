package com.backend.starter.catalog.repo;

import com.backend.starter.catalog.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;

public interface TagRepository extends JpaRepository<Tag, Long>, JpaSpecificationExecutor<Tag> {

    List<Tag> findByIdIn(Collection<Long> ids);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    java.util.Optional<Tag> findBySlug(String slug);
}
