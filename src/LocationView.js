import React from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Animated, Platform, UIManager, TouchableOpacity,Image, Text, ViewPropTypes } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Entypo from 'react-native-vector-icons/Entypo';
import axios from 'axios';
import Events from 'react-native-simple-events';
import MapView, {
  Marker,
  Callout,
  CalloutSubview,
  ProviderPropType,
} from 'react-native-maps';

import CustomCallout from './CustomCallout';

const PLACE_DETAIL_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEFAULT_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.0121 };

export default class LocationView extends React.Component {
  static propTypes = {
    apiKey: PropTypes.string.isRequired,
    initialLocation: PropTypes.shape({
      latitude: PropTypes.number,
      longitude: PropTypes.number,
    }).isRequired,
    markerColor: PropTypes.string,
    actionButtonStyle: ViewPropTypes.style,
    actionTextStyle: Text.propTypes.style,
    actionText: PropTypes.string,
    onLocationSelect: PropTypes.func,
    debounceDuration: PropTypes.number,
    components: PropTypes.arrayOf(PropTypes.string),
  };

  static defaultProps = {
    markerColor: 'black',
    actionText: 'DONE',
    onLocationSelect: () => ({}),
    debounceDuration: 300,
    components: [],
  };

  constructor(props) {
    super(props);
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }

  componentDidMount() {
    Events.listen('InputBlur', this.constructor.displayName, this._onTextBlur);
    Events.listen('InputFocus', this.constructor.displayName, this._onTextFocus);
    Events.listen('PlaceSelected', this.constructor.displayName, this._onPlaceSelected);
    this._getRegionForCoordinates(this.props.markers);
  }

  componentWillUnmount() {
    Events.rm('InputBlur', this.constructor.displayName);
    Events.rm('InputFocus', this.constructor.displayName);
    Events.rm('PlaceSelected', this.constructor.displayName);
  }

  state = {
    inputScale: new Animated.Value(1),
    inFocus: false,
    region: {
      ...DEFAULT_DELTA,
      ...this.props.initialLocation,
    },
    selectedMarker: null
  };

  _getRegionForCoordinates = (points) => {
    let minX, maxX, minY, maxY;
  
    // init first point
    ((point) => {
      minX = point.latitude;
      maxX = point.latitude;
      minY = point.longitude;
      maxY = point.longitude;
    })(points[0]);
  
    // calculate rect
    points.map((point) => {
      minX = Math.min(minX, point.latitude);
      maxX = Math.max(maxX, point.latitude);
      minY = Math.min(minY, point.longitude);
      maxY = Math.max(maxY, point.longitude);
    });
  
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const deltaX = (maxX - minX);
    const deltaY = (maxY - minY);

    this.setState(prevState => ({...prevState, region: {
      latitude: midX,
      longitude: midY,
      latitudeDelta: deltaX,
      longitudeDelta: deltaY
    }}))
  }

  _animateInput = () => {
    Animated.timing(this.state.inputScale, {
      toValue: this.state.inFocus ? 1.2 : 1,
      duration: 300,
    }).start();
  };

  _onMapRegionChange = region => {
    this._setRegion(region, false);
  };

  _onMapRegionChangeComplete = region => {
  };

  _onTextFocus = () => {
    this.state.inFocus = true;
    this._animateInput();
  };

  _onTextBlur = () => {
    this.state.inFocus = false;
    this._animateInput();
  };

  _setRegion = (region, animate = true) => {
    this.marker2.hideCallout();
    this.state.region = { ...this.state.region, ...region };
    if (animate) this._map.animateToRegion(this.state.region);
  };

  _onPlaceSelected = placeId => {
    axios.get(`${PLACE_DETAIL_URL}?key=${this.props.apiKey}&placeid=${placeId}`).then(({ data }) => {
      let region = (({ lat, lng }) => ({ latitude: lat, longitude: lng }))(data.result.geometry.location);
      this._setRegion(region);
    });
  };

  _getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(position => {
      let location = (({ latitude, longitude }) => ({ latitude, longitude }))(position.coords);
      this._setRegion(location);
    });
  };

  _onMarkerPress = (location) => {
    this.setState(prevState=> ({...prevState, selectedMarker: location}))
  }

  _toKilometers = (distance) => {
    return (distance / 1000).toFixed(1) + " " + this.props.kilometersText;
  }

  render() {
    let { inputScale } = this.state;
    return (
      <View style={styles.container}>
        <MapView
          ref={mapView => (this._map = mapView)}
          style={styles.mapView}
          region={this.state.region}
          showsMyLocationButton={true}
          showsUserLocation={false}
        >
            { this.props.markers && this.props.markers.map((location, index) => {
              const { latitude, longitude } = location;
                   return (
                       <MapView.Marker
                           key={location.id}
                           coordinate={{ latitude, longitude }}
                           calloutOffset={{ x: -8, y: 28 }}
                           calloutAnchor={{ x: 0.5, y: 0.4 }}
                           ref={ref => {
                             this.marker2 = ref;
                           }}
                       >
                         <Image source={location.type == 1 ? this.props.marker1: this.props.marker2} style={{ width: 32, height: 50 }} />
                                    <Callout
              alphaHitTest
              tooltip
              style={styles.customView}
            >
              <CustomCallout>
                <Text style={this.props.markerDistanceStyle}>{this._toKilometers(location.distance)}</Text>
                <Text style={this.props.markerNameStyle}>{location.name}</Text>
                <Text style={this.props.markerAddressStyle}>{location.address}</Text>
                <CalloutSubview
                  onPress={() => this.props.showDetails(location)}
                  style={[styles.calloutButton]}
                >
            <Text style={this.props.markerButtonStyle}>{this.props.markerButtonText}
            <MaterialIcons name={this.props.arrowName} size={12} />
            </Text>
                </CalloutSubview>
              </CustomCallout>
            </Callout>
                       </MapView.Marker>
                   )
               })
           }
        </MapView>

        <TouchableOpacity
          style={[styles.currentLocBtn, { backgroundColor: this.props.markerColor }]}
          onPress={this._getCurrentLocation}
        >
          <MaterialIcons name={'my-location'} color={'white'} size={25} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, this.props.actionButtonStyle]}
          onPress={() => this.props.onLocationSelect({ ...this.state.region
          })}
        >
          <View>
            <Text style={[styles.actionText, this.props.actionTextStyle]}>{this.props.actionText}</Text>
          </View>
        </TouchableOpacity>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapView: {
    ...StyleSheet.absoluteFillObject,
  },
  fullWidthContainer: {
    position: 'absolute',
    width: '100%',
    top: 80,
    alignItems: 'center',
  },
  input: {
    width: '80%',
    padding: 5,
  },
  currentLocBtn: {
    backgroundColor: '#000',
    padding: 5,
    borderRadius: 5,
    position: 'absolute',
    bottom: 70,
    right: 10,
  },
  actionButton: {
    backgroundColor: '#000',
    height: 50,
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
  },
  actionText: {
    color: 'white',
    fontSize: 23,
  },
  customView: {
    width: 240,
    // height: 140,
  },
  marker: {
    width: 50
  }
});
