package com.backend.starter.catalog.repo;

import com.backend.starter.catalog.entity.ProductTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ProductTagRepository extends JpaRepository<ProductTag, Long> {

    List<ProductTag> findByProductId(Long productId);

    List<ProductTag> findByProductIdIn(Collection<Long> productIds);

    void deleteByProductId(Long productId);

    void deleteByTagId(Long tagId);
}
