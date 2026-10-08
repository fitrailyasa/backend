class CollectionQuery
  def initialize(scope, paging:, sortable:)
    @scope = scope
    @paging = paging
    @sortable = sortable
    @table = scope.klass.table_name
  end

  def results(preload: nil)
    column = @sortable.include?(@paging[:sort]) ? @paging[:sort] : "id"
    direction = @paging[:order] == "asc" ? "ASC" : "DESC"
    total = @scope.except(:order).distinct.count("#{@table}.id")
    total = total.is_a?(Hash) ? total.values.sum : total.to_i
    relation = @scope.distinct.reorder(Arel.sql("#{@table}.#{column} #{direction}"))
    relation = relation.offset((@paging[:page] - 1) * @paging[:limit]).limit(@paging[:limit])
    relation = relation.preload(*preload) if preload.present?
    rows = relation.to_a
    meta = {
      page: @paging[:page],
      limit: @paging[:limit],
      total: total,
      total_pages: @paging[:limit].positive? ? (total.to_f / @paging[:limit]).ceil : 0
    }
    [rows, meta]
  end
end
