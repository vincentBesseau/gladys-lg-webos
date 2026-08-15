# LG webOS

Cette intégration contrôle localement une TV LG webOS depuis Gladys Assistant.

## Découverte automatique

1. Allumez la TV, puis installez et démarrez l'intégration sans renseigner d'adresse IP.
2. Ouvrez l'onglet **Découvrir** puis cliquez sur **Scanner**.
3. Gladys envoie une recherche SSDP pour le service webOS `urn:lge-com:service:webos-second-screen:1` depuis le réseau hôte.
4. L'intégration récupère le nom, le modèle et l'identifiant UDN de chaque TV depuis sa description UPnP.
5. Ajoutez votre TV dans Gladys. Son IP et son UDN sont alors conservés automatiquement.
6. Lors de la première connexion, une demande d'association webOS s'affiche sur la TV : acceptez-la avec la télécommande.

L'UDN fourni par la TV est utilisé comme identifiant stable. Ainsi, un changement d'adresse IP détecté lors d'un nouveau scan met à jour la connexion sans recréer le device.

## Wake-on-LAN

SSDP ne fournit pas de manière fiable l'adresse MAC de la TV. Le contrôle de la TV allumée et l'extinction fonctionnent sans MAC, mais pour **allumer** la TV depuis Gladys, renseignez son adresse MAC dans la configuration de l'intégration.

Il est recommandé de conserver un bail DHCP fixe pour la TV même si la découverte peut retrouver une nouvelle IP.

## Connexion

Le mode **Automatique** tente `ws://TV:3000` puis `wss://TV:3001`. Sur certains firmwares récents, webOS impose le port sécurisé avec un certificat auto-signé.

L'intégration expose l'alimentation, le volume, le mute, lecture/pause/stop, volume +/-, chaîne +/- et l'envoi de notifications toast.
