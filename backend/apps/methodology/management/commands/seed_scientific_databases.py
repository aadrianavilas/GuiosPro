from typing import Any
from django.core.management.base import BaseCommand
from apps.methodology.models.scientific_database import ScientificDatabase


class Command(BaseCommand):
    """
    Comando para poblar las bases de datos científicas predeterminadas del sistema.
    """
    help = "Puebla las bases de datos científicas iniciales para la consulta automatizada con IA"

    DEFAULT_DATABASES = [
        {
            "name": "Scopus",
            "description": "Base de datos bibliográfica de resúmenes y citas de artículos de revistas científicas.",
        },
        {
            "name": "IEEE Xplore",
            "description": "Literatura de investigación académica en ingeniería eléctrica, electrónica y ciencias de la computación.",
        },
        {
            "name": "Web of Science",
            "description": "Base de datos científica interdisciplinaria con información sobre investigación y análisis de citas.",
        },
        {
            "name": "ScienceDirect",
            "description": "Publicaciones científicas revisadas por pares de Elsevier en ciencias físicas, de la vida, salud y sociales.",
        },
    ]

    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write(self.style.NOTICE("Poblando bases de datos científicas predeterminadas..."))
        created_count = 0
        updated_count = 0

        for item in self.DEFAULT_DATABASES:
            obj, created = ScientificDatabase.objects.update_or_create(
                name=item["name"],
                defaults={
                    "description": item["description"],
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  + Creada base científica: {obj.name}"))
            else:
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f"  ✓ Actualizada base científica: {obj.name}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Proceso completado: {created_count} creadas, {updated_count} actualizadas."
            )
        )
