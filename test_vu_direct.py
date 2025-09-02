#!/usr/bin/env python3
"""
Test directo del VU meter - Captura y reporta el estado
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QPixmap, QPainter
from ui.vu_meter import VUMeterWidget

def test_vu_meter():
    """Test directo sin GUI visible"""
    app = QApplication(sys.argv)
    
    print("\n=== PRUEBA DIRECTA DEL VU METER ===")
    
    # Crear widget
    vu = VUMeterWidget()
    vu.setFixedSize(600, 60)  # Tamaño de producción
    
    # Test 1: Configuración inicial
    print(f"1. Altura configurada: {vu.height()}px")
    print(f"   Ancho configurado: {vu.width()}px")
    print(f"   Rango dB: {vu.min_db} a {vu.max_db} dB")
    
    # Test 2: Establecer niveles diferentes para L y R
    vu.update_db_levels(-10, -20)
    print(f"\n2. Niveles establecidos:")
    print(f"   Canal L: {vu.left_db:.1f} dB")
    print(f"   Canal R: {vu.right_db:.1f} dB")
    
    # Test 3: Renderizar y capturar
    pixmap = QPixmap(vu.size())
    vu.render(pixmap)
    
    # Analizar pixmap para verificar que hay contenido
    img = pixmap.toImage()
    
    # Contar píxeles no negros en diferentes zonas
    top_half_colored = 0
    bottom_half_colored = 0
    
    for y in range(img.height()):
        for x in range(img.width()):
            pixel = img.pixelColor(x, y)
            if pixel.red() > 30 or pixel.green() > 30 or pixel.blue() > 30:
                if y < img.height() // 2:
                    top_half_colored += 1
                else:
                    bottom_half_colored += 1
    
    print(f"\n3. Análisis del renderizado:")
    print(f"   Píxeles coloreados en mitad superior: {top_half_colored}")
    print(f"   Píxeles coloreados en mitad inferior: {bottom_half_colored}")
    
    # Verificación
    both_halves_active = top_half_colored > 100 and bottom_half_colored > 100
    
    print(f"\n4. RESULTADO:")
    if both_halves_active:
        print("   ✅ AMBOS CANALES SE ESTÁN RENDERIZANDO")
        print("   ✅ Canal L (superior) activo")
        print("   ✅ Canal R (inferior) activo")
    else:
        print("   ⚠️  PROBLEMA DETECTADO:")
        if top_half_colored < 100:
            print("   ❌ Canal L (superior) no visible")
        if bottom_half_colored < 100:
            print("   ❌ Canal R (inferior) no visible")
    
    # Test 4: Verificar que los niveles son independientes
    vu.update_db_levels(0, -30)  # L alto, R bajo
    print(f"\n5. Test de independencia:")
    print(f"   L establecido a 0 dB, R a -30 dB")
    print(f"   L actual: {vu.left_db:.1f} dB")
    print(f"   R actual: {vu.right_db:.1f} dB")
    print(f"   Independientes: {'✅ SÍ' if abs(vu.left_db - vu.right_db) > 20 else '❌ NO'}")
    
    print("\n=== FIN DE LA PRUEBA ===\n")
    
    return both_halves_active

if __name__ == "__main__":
    success = test_vu_meter()
    sys.exit(0 if success else 1)