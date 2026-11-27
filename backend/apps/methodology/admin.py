from django.contrib import admin
from apps.methodology.models import (
    Dimension,
    Factor,
    Subfactor,
    Scale,
    ScaleLevel,
    Scope,
    Recommendation,
)


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "order")
    ordering = ("order",)


admin.site.register(Dimension)
admin.site.register(Factor)
admin.site.register(Subfactor)
admin.site.register(Scale)
admin.site.register(ScaleLevel)
admin.site.register(Scope)

