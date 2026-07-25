import os
from PIL import Image

def redimensionar_imagen(ruta_entrada, ruta_salida, porcentaje=25):
    """
    Reduce la resolución de una imagen.
    
    :param ruta_entrada: Ruta de la imagen original (ej. 'WhatsApp Image 2026-07-21 at 18.03.12.jpeg')
    :param ruta_salida: Ruta donde se guardará la imagen modificada
    :param porcentaje: Porcentaje del tamaño original (ej. 50 para reducir a la mitad)
    """
    try:
        # Abrir la imagen
        with Image.open(ruta_entrada) as img:
            # Calcular las nuevas dimensiones
            ancho = int(img.width * (porcentaje / 100))
            alto = int(img.height * (porcentaje / 100))
            
            # Redimensionar la imagen (usando el filtro LANCZOS para mantener calidad)
            img_redimensionada = img.resize((ancho, alto), Image.Resampling.LANCZOS)
            
            # Guardar la nueva imagen
            img_redimensionada.save(ruta_salida, optimize=True, quality=85)
            
            print(f"✅ Imagen guardada con éxito en: {ruta_salida}")
            print(f"Resolución original: {img.width}x{img.height}")
            print(f"Nueva resolución: {ancho}x{alto}")
            
    except FileNotFoundError:
        print(f"❌ Error: No se encontró la imagen en la ruta '{ruta_entrada}'")
    except Exception as e:
        print(f"❌ Ocurrió un error inesperado: {e}")

# --- Ejemplo de uso ---
if __name__ == "__main__":
    # Nombre de tu archivo (asegúrate de que esté en la misma carpeta que este script)
    archivo_original = "WhatsApp Image 2026-07-21 at 18.03.12.jpeg"
    archivo_nuevo = "imagen_reducida.jpeg"
    
    # Reducir al 50% de su tamaño original
    redimensionar_imagen(archivo_original, archivo_nuevo, porcentaje=25)