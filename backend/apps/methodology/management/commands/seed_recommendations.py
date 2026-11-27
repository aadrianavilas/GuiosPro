from django.core.management.base import BaseCommand
from apps.methodology.models.recommendation import Recommendation


class Command(BaseCommand):
    help = "Carga o actualiza las tres recomendaciones oficiales de la metodología GUIOS en la base de datos."

    RECOMMENDATIONS_DATA = [
        {
            "code": "A",
            "title": "Adoptar",
            "description": (
                "Adoptar. Todos los factores han sido identificados como Oportunidades y/o Fortalezas. "
                "Esto quiere decir que la organización cumple satisfactoriamente con la mayoría de requisitos "
                "para adoptar la solución FLOSS."
            ),
            "order": 1,
        },
        {
            "code": "B",
            "title": "Es posible adoptar",
            "description": (
                "Es posible adoptar. A pesar que se han detectado amenazas y/o debilidades en factores "
                "cuya importancia relativa es opcional, por lo tanto, se sugiere revisar los criterios "
                "que no cumplen con lo mínimo requerido para adoptar."
            ),
            "order": 2,
        },
        {
            "code": "C",
            "title": "No se debe adoptar",
            "description": (
                "La organización debe de proporcionar los recursos necesarios que garanticen una adopción satisfactoria. "
                "Si se trata de factores internos deben de ser aspectos a mejorar dentro de la organización y "
                "si son factores externos, dedicar recursos de ingeniería para mejorar el software."
            ),
            "order": 3,
        },
    ]

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando carga de recomendaciones GUIOS..."))

        total_created = 0
        total_updated = 0

        for item in self.RECOMMENDATIONS_DATA:
            obj, created = Recommendation.objects.update_or_create(
                code=item["code"],
                defaults={
                    "title": item["title"],
                    "description": item["description"],
                    "order": item["order"],
                },
            )
            if created:
                total_created += 1
                self.stdout.write(self.style.SUCCESS(f"  + Creada recomendación {obj.code}: {obj.title}"))
            else:
                total_updated += 1
                self.stdout.write(self.style.WARNING(f"  * Actualizada recomendación {obj.code}: {obj.title}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nProceso finalizado: {total_created} creadas, {total_updated} actualizadas."
            )
        )
