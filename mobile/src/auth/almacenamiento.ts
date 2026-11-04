import * as SecureStore from "expo-secure-store"
import { type DatosRegistro } from './registro';
import { Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';


const CLAVE_CUENTA = "cuenta"

 async function guardarTexto(clave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(clave, valor);
  } else {
    await SecureStore.setItemAsync(clave, valor);
  }
}

async function leerTexto(clave: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(clave);
  }
  return await SecureStore.getItemAsync(clave);
}

export async function guardarCuenta(datos: DatosRegistro): Promise<void>{
      const datosString = JSON.stringify(datos)
      await guardarTexto(CLAVE_CUENTA, datosString)
  }
export async function leerCuenta():Promise<DatosRegistro | null>{
       const datosLeidos = await leerTexto(CLAVE_CUENTA)
          if(datosLeidos === null){
              return null
          }
          else{
              return JSON.parse(datosLeidos) as DatosRegistro
          }
  }